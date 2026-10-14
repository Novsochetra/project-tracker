import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { trackRunChanges } from '../../src/watch/changes/runChanges';
import { fakeTracker, job, RUNNER } from '../watch/fakeTracker';

// PT-229 review: a snapshot that failed turned change tracking off with no word in the window.
let folder: string;

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'tracker-off-'));
  git('init', '-q', '-b', 'main');
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

function track(deadlineMs?: number) {
  const tracker = fakeTracker([]);
  const log: string[] = [];
  const deps = {
    api: tracker.api,
    cwd: folder,
    runnerId: RUNNER,
    log: (text: string) => log.push(text),
    describe: String,
    deadlineMs,
  };
  return { tracker, log, start: () => trackRunChanges(deps, job('r-1', 'MOB-1')) };
}

describe('change tracking that turns off (PT-237)', () => {
  it('logs one short line naming no file when git add fails', async () => {
    const hidden = join(folder, 'token-ghp_abc.txt');
    writeFileSync(hidden, 'x');
    chmodSync(hidden, 0o000);
    const { tracker, log, start } = track();
    await (
      await start()
    )({ status: 'done' });
    expect(tracker.changes).toEqual([]);
    expect(log).toEqual([
      "MOB-1: Changes aren't tracked in this run: git couldn't read the folder.",
    ]);
  });

  it('logs when the deadline passes', async () => {
    const { log, start } = track(1);
    await start();
    expect(log).toEqual(["MOB-1: Changes aren't tracked in this run: git took longer than 30 s."]);
  });
});
