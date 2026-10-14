import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CHANGED_SINCE_LOOKED,
  GH_NOT_SET_UP,
  PROTECTED_BRANCH,
  type GitActionJob,
} from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree } from '../../src/watch/changes/snapshot';
import { createGitActions } from '../../src/watch/gitActions/takeGitActions';
import { createWatcher } from '../../src/watch/watcher';
import { fakeTracker, noAsks, RUNNER } from './fakeTracker';

let root: string;
// The snapshot the person looked at on the phone.
let seen = '';
let folder: string;
const path = process.env.PATH;

const gitIn = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const git = (...args: string[]) => gitIn(folder, ...args);
const write = (file: string, text: string) => writeFileSync(join(folder, file), text);

function commit(file: string, text: string) {
  write(file, text);
  git('add', file);
  git('commit', '-qm', file);
}

// Records each call's arguments a line each, between --- lines.
const FAKE_GH = `#!/bin/sh
{ echo ---; printf '%s\\n' "$@"; } >> "$FAKE_GH_LOG"
case "$1 $2" in
  "auth status") exit "\${FAKE_GH_AUTH:-0}";;
  "repo view") echo main;;
  "pr create") echo "Creating pull request"; echo "https://github.com/o/r/pull/7";;
esac
`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tracker-git-actions-'));
  folder = join(root, 'work');
  mkdirSync(folder);
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  process.env.PATH = `${bin}:${path ?? ''}`;
  process.env.FAKE_GH_LOG = join(root, 'gh.log');
  process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = 'T';
  process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = 't@example.com';
  delete process.env.FAKE_GH_AUTH;
  gitIn(root, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', join(root, 'origin.git'));
  commit('a.ts', 'const a = 1;\n');
  commit('gone.ts', 'old\n');
  commit('staged.md', 'staged\n');
  commit('notes.md', 'notes\n');
});

afterEach(() => {
  process.env.PATH = path;
  rmSync(root, { recursive: true, force: true });
});

async function run(job: GitActionJob) {
  const tracker = fakeTracker([], [job]);
  const log: string[] = [];
  const deps = {
    api: tracker.api,
    cwd: folder,
    runnerId: RUNNER,
    log: (text: string) => log.push(text),
    describe: String,
  };
  await createGitActions(deps)();
  return { ended: tracker.gitEnded, log };
}

const look = async () => {
  seen = (await snapshotTree(folder, AbortSignal.timeout(10_000))) ?? '';
};

const commitJob = (
  body: Partial<Extract<GitActionJob, { kind: 'commit' }>> = {},
): GitActionJob => ({
  id: 'g-1',
  chatId: 'chat-1234567890',
  kind: 'commit',
  message: 'Fix the login',
  paths: ['a.ts', 'b.ts', 'gone.ts'],
  branch: null,
  tree: seen,
  keep: [{ path: 'notes.md', dirtyBefore: true }],
  ...body,
});

const prJob: GitActionJob = {
  id: 'g-2',
  chatId: 'chat-1234567890',
  kind: 'pull_request',
  title: '-Fix the login',
  keep: [],
};

const ghCalls = () =>
  readFileSync(join(root, 'gh.log'), 'utf8')
    .split('---\n')
    .filter(Boolean)
    .map((call) => call.trimEnd().split('\n'));

describe('Commit', () => {
  beforeEach(async () => {
    write('a.ts', 'const a = 2;\n');
    write('b.ts', 'export const b = 1;\n');
    rmSync(join(folder, 'gone.ts'));
    write('staged.md', 'the person staged this\n');
    git('add', 'staged.md');
    write('notes.md', 'the person wrote this\n');
    await look();
  });

  it("commits only the picked files and leaves the person's index and edits alone", async () => {
    const { ended, log } = await run(commitJob());
    expect(git('show', '--name-status', '--format=%s', 'HEAD').trim().split('\n')).toEqual([
      'Fix the login',
      '',
      'M\ta.ts',
      'A\tb.ts',
      'D\tgone.ts',
    ]);
    expect(git('status', '--porcelain').trimEnd().split('\n')).toEqual([
      ' M notes.md',
      'M  staged.md',
    ]);
    const sha = git('rev-parse', 'HEAD').trim();
    expect(ended).toEqual([
      {
        id: 'g-1',
        runnerId: RUNNER,
        status: 'done',
        result: { sha, branch: 'main' },
        changes: expect.objectContaining({
          files: [{ path: 'notes.md', dirtyBefore: true }],
          branch: 'main',
          ghReady: true,
        }) as unknown,
      },
    ]);
    expect(log).toEqual(['chat chat-123: The commit is done.']);
  });

  it('commits on a new branch the person named, and takes a message that starts with a dash', async () => {
    const { ended } = await run(commitJob({ branch: 'chat/fix-login', message: '--amend' }));
    expect(git('branch', '--show-current').trim()).toBe('chat/fix-login');
    expect(git('log', '-1', '--format=%s', 'main').trim()).toBe('notes.md');
    expect(git('log', '-1', '--format=%s').trim()).toBe('--amend');
    expect(ended[0]?.result?.branch).toBe('chat/fix-login');
  });

  // Two commits with a hook each pass 5 s on a busy machine.
  it('fails with why and puts the index and the branch back as they were', async () => {
    const hook = join(folder, '.git/hooks/pre-commit');
    writeFileSync(
      hook,
      '#!/bin/sh\necho "lint failed: TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123" >&2\nexit 1\n',
    );
    chmodSync(hook, 0o755);
    const before = git('status', '--porcelain');
    const { ended, log } = await run(commitJob({ branch: 'chat/fix-login' }));
    expect(ended[0]).toMatchObject({ status: 'failed' });
    expect(ended[0]?.error).toContain('The commit failed; nothing was committed. lint failed');
    expect(ended[0]?.error).not.toContain('ghp_');
    expect(log).toEqual(['chat chat-123: The commit failed.']);
    expect(git('status', '--porcelain')).toBe(before);
    expect(git('branch', '--show-current').trim()).toBe('main');
    expect(git('branch', '--list').trim()).toBe('* main');
    rmSync(hook);
    const again = await run(commitJob({ branch: 'chat/fix-login' }));
    expect(again.ended[0]).toMatchObject({ status: 'done', result: { branch: 'chat/fix-login' } });
  }, 20_000);

  it('commits nothing that changed since the person looked', async () => {
    write('a.ts', 'const a = "changed after the look";\n');
    const head = git('rev-parse', 'HEAD');
    const { ended } = await run(commitJob());
    expect(ended[0]).toMatchObject({ status: 'failed', error: CHANGED_SINCE_LOOKED });
    expect(git('rev-parse', 'HEAD')).toBe(head);
  });

  it('never makes a branch git would read as a flag', async () => {
    const refused = await run(commitJob({ branch: '--force' }));
    expect(refused.ended[0]).toMatchObject({ status: 'failed' });
    expect(git('branch', '--list').trim()).toBe('* main');
  });
});

describe('Open PR', () => {
  it('pushes the branch to the same name and opens a pull request into the default branch', async () => {
    git('switch', '-q', '-c', 'chat/fix');
    commit('c.ts', 'export {};\n');
    const { ended } = await run(prJob);
    expect(ended[0]).toMatchObject({
      status: 'done',
      result: { branch: 'chat/fix', url: 'https://github.com/o/r/pull/7' },
    });
    expect(gitIn(join(root, 'origin.git'), 'branch', '--list').trim()).toBe('chat/fix');
    expect(ghCalls().find((call) => call[0] === 'pr')).toEqual([
      'pr',
      'create',
      '--head=chat/fix',
      '--title=-Fix the login',
      '--body=Opened from a chat in the project tracker.',
      '--base=main',
    ]);
  });

  it('never pushes main, and says when gh is not set up', async () => {
    const onMain = await run(prJob);
    expect(onMain.ended[0]).toMatchObject({ status: 'failed', error: PROTECTED_BRANCH });
    expect(gitIn(join(root, 'origin.git'), 'branch', '--list').trim()).toBe('');
    git('switch', '-q', '-c', 'chat/fix');
    process.env.FAKE_GH_AUTH = '1';
    const signedOut = await run(prJob);
    expect(signedOut.ended[0]).toMatchObject({ status: 'failed', error: GH_NOT_SET_UP });
    expect(gitIn(join(root, 'origin.git'), 'branch', '--list').trim()).toBe('');
  });
});

describe("the helper's ticket lane", () => {
  it('runs the commits the person asked for before its next run, and the ask lane none', async () => {
    write('a.ts', 'const a = 3;\n');
    await look();
    const tracker = fakeTracker([], [commitJob({ paths: ['a.ts'] })]);
    const watcher = createWatcher(
      {
        api: tracker.api,
        runClaude: () => Promise.reject(new Error('No runs here.')),
        runAsk: noAsks,
        log: () => {},
        changesIn: folder,
      },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    await watcher.lookForWork();
    expect(tracker.gitEnded).toMatchObject([{ id: 'g-1', status: 'done' }]);
    expect(tracker.api.takeGitAction).toHaveBeenCalledTimes(2);
    const event = { type: 'chat-git', actionId: 'g-2', chatId: 'c', projectId: 'p' } as const;
    watcher.onGitEvent({ ...event, runnerId: 'another', status: 'queued' });
    watcher.onGitEvent({ ...event, runnerId: RUNNER, status: 'done' });
    await watcher.lookForWork();
    expect(tracker.api.takeGitAction).toHaveBeenCalledTimes(3);
  });
});
