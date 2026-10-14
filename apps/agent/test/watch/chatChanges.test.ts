import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDiff, type AskMode, type ChatChangedFile, type RunJob } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { trackChatChanges } from '../../src/watch/changes/chatChanges';
import { askJob, fakeTracker, RUNNER } from './fakeTracker';

let folder: string;

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const write = (file: string, text: string) => writeFileSync(join(folder, file), text);

function commit(file: string, text: string) {
  write(file, text);
  git('add', file);
  git('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', file);
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'tracker-chat-changes-'));
  git('init', '-q', '-b', 'main');
  commit('a.ts', 'const a = 1;\n');
  commit('notes.md', 'notes\n');
  commit('other.md', 'other\n');
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

const editJob = (chatFiles: ChatChangedFile[] | undefined = [], mode: AskMode = 'edit'): RunJob => {
  const job = askJob('r-1', 'chat-1', null, { model: 'default', mode, effort: 'default' });
  return chatFiles ? { ...job, chatFiles } : job;
};

async function turn(job: RunJob, change: () => void) {
  const tracker = fakeTracker([]);
  const deps = {
    api: tracker.api,
    cwd: folder,
    runnerId: RUNNER,
    log: () => {},
    describe: String,
    ghCheck: () => Promise.resolve(true),
  };
  const send = await trackChatChanges(deps, job);
  change();
  await send({ status: 'done', answer: 'Done.' });
  return tracker.chatChanges;
}

describe("an Edit chat turn's changes", () => {
  it("sends the turn's files against the last commit, with the ones dirty before it marked", async () => {
    write('notes.md', 'my own edit\n');
    write('other.md', 'my other edit\n');
    const [sent, ...more] = await turn(editJob(), () => {
      write('a.ts', 'const a = 2;\n');
      write('b.ts', 'TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n');
      write('notes.md', 'my own edit\nand more\n');
    });
    expect(more).toEqual([]);
    expect(sent).toMatchObject({
      id: 'r-1',
      runnerId: RUNNER,
      cut: false,
      branch: 'main',
      ghReady: true,
    });
    expect(sent?.files).toEqual([
      { path: 'a.ts', dirtyBefore: false },
      { path: 'b.ts', dirtyBefore: false },
      { path: 'notes.md', dirtyBefore: true },
    ]);
    expect(parseDiff(sent?.diff ?? '').map((file) => [file.path, file.status])).toEqual([
      ['a.ts', 'modified'],
      ['b.ts', 'added'],
      ['notes.md', 'modified'],
    ]);
    expect(sent?.diff).not.toContain('ghp_');
    expect(sent?.diff).not.toContain('other.md');
  });

  it("adds to the chat's files, keeps how each started and drops one changed back", async () => {
    const previous = [
      { path: 'a.ts', dirtyBefore: false },
      { path: 'notes.md', dirtyBefore: true },
    ];
    write('notes.md', 'still dirty\n');
    const [sent] = await turn(editJob(previous), () => {
      write('a.ts', 'const a = 1;\n');
      write('c.ts', 'export {};\n');
    });
    expect(sent?.files).toEqual([
      { path: 'notes.md', dirtyBefore: true },
      { path: 'c.ts', dirtyBefore: false },
    ]);
  });

  it('sends nothing for Ask, a cancelled turn, an older tracker or a turn that changed nothing', async () => {
    const change = () => write('a.ts', 'const a = 5;\n');
    expect(await turn(editJob([], 'ask'), change)).toEqual([]);
    expect(await turn(editJob(undefined), change)).toEqual([]);
    expect(await turn(editJob(), () => {})).toEqual([]);
    const tracker = fakeTracker([]);
    const deps = {
      api: tracker.api,
      cwd: folder,
      runnerId: RUNNER,
      log: () => {},
      describe: String,
      ghCheck: () => Promise.resolve(true),
    };
    const send = await trackChatChanges(deps, editJob());
    change();
    await send({ status: 'cancelled' });
    expect(tracker.chatChanges).toEqual([]);
  });

  it('sends Auto turns too', async () => {
    const [sent] = await turn(editJob([], 'auto'), () => write('a.ts', 'const a = 9;\n'));
    expect(sent?.files).toEqual([{ path: 'a.ts', dirtyBefore: false }]);
  });
});
