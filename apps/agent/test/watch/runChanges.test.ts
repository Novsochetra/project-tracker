import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDiff, type RunJob } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickBase } from '../../src/watch/changes/diffBase';
import { trackRunChanges } from '../../src/watch/changes/runChanges';
import { createWatcher } from '../../src/watch/watcher';
import { fakeTracker, job, noAsks, RUNNER } from './fakeTracker';

let folder: string;

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

function commit(file: string, text: string) {
  writeFileSync(join(folder, file), text);
  git('add', file);
  git('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', file);
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'tracker-changes-'));
  git('init', '-q', '-b', 'main');
  commit('a.ts', 'const a = 1;\n');
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

function track(theJob: RunJob = job('r-1', 'MOB-1')) {
  const tracker = fakeTracker([]);
  const log: string[] = [];
  const deps = {
    api: tracker.api,
    cwd: folder,
    runnerId: RUNNER,
    log: (text: string) => log.push(text),
    describe: String,
  };
  return { tracker, log, start: () => trackRunChanges(deps, theJob) };
}

describe("a ticket run's changes", () => {
  it('sends what changed since the run started, new files and commits too, masked', async () => {
    const { tracker, start } = track();
    const send = await start();
    commit('b.ts', 'export const b = 2;\n');
    writeFileSync(join(folder, 'a.ts'), 'const a = 3;\n');
    writeFileSync(
      join(folder, 'new file.env'),
      'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n',
    );
    await send({ status: 'done' });
    const [sent] = tracker.changes;
    expect(sent).toMatchObject({ id: 'r-1', runnerId: RUNNER, cut: false });
    const files = parseDiff(sent?.diff ?? '');
    expect(files.map(({ path, status }) => [path, status])).toEqual([
      ['a.ts', 'modified'],
      ['b.ts', 'added'],
      ['new file.env', 'added'],
    ]);
    expect(sent?.diff).toContain('+GITHUB_TOKEN=***');
    expect(sent?.diff).not.toContain('ghp_');
  });

  it('sends an empty change when nothing changed, and nothing for a cancelled run', async () => {
    const { tracker, start } = track();
    const send = await start();
    await send({ status: 'cancelled' });
    expect(tracker.changes).toEqual([]);
    await send({ status: 'failed', error: 'x' });
    expect(tracker.changes).toEqual([{ id: 'r-1', runnerId: RUNNER, diff: '', cut: false }]);
  });

  it('sends nothing for a review run or outside a git repository', async () => {
    const review = job('r-2', 'MOB-1');
    const { tracker, start } = track({ ...review, run: { ...review.run, role: 'review' } });
    await (
      await start()
    )({ status: 'done' });
    rmSync(join(folder, '.git'), { recursive: true });
    const plain = track();
    await (
      await plain.start()
    )({ status: 'done' });
    expect([...tracker.changes, ...plain.tracker.changes]).toEqual([]);
  });

  it('logs a send that fails and goes on', async () => {
    const { tracker, log, start } = track();
    vi.mocked(tracker.api.addRunChanges).mockRejectedValueOnce(new Error('offline'));
    await (
      await start()
    )({ status: 'done' });
    expect(log).toEqual(["MOB-1: Couldn't send the changes: Error: offline"]);
  });

  it('goes before the run ends', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    const watcher = createWatcher(
      {
        api: tracker.api,
        runClaude: () => Promise.resolve({ code: 0, signal: null, output: '', results: [] }),
        runAsk: noAsks,
        log: () => {},
        changesIn: folder,
      },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    await watcher.lookForWork();
    const [changesCall] = vi.mocked(tracker.api.addRunChanges).mock.invocationCallOrder;
    const [finishCall] = vi.mocked(tracker.api.finishRun).mock.invocationCallOrder;
    expect(changesCall).toBeLessThan(finishCall!);
  });
});

describe('pickBase', () => {
  const facts = { branch: 'main', defaultBranch: 'origin/main', mergeBase: 'm1', start: 's1' };

  it('takes the run start on the default branch, and where the branch left it elsewhere', () => {
    expect(pickBase(facts)).toBe('s1');
    expect(pickBase({ ...facts, branch: 'ticket/pt-1' })).toBe('m1');
    expect(pickBase({ ...facts, branch: 'ticket/pt-1', mergeBase: null })).toBe('s1');
    expect(pickBase({ ...facts, defaultBranch: null, branch: 'x' })).toBe('s1');
  });
});
