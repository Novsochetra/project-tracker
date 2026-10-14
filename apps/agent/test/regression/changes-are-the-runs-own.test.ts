import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDiff } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { trackRunChanges } from '../../src/watch/changes/runChanges';
import { fakeTracker, job, RUNNER } from '../watch/fakeTracker';

// PT-229 review: the run's start commit was compared with the working tree, so the owner's own
// uncommitted edits and untracked notes were uploaded as the ticket's, and on a branch every
// ticket showed the whole branch since main.
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
  folder = mkdtempSync(join(tmpdir(), 'tracker-own-changes-'));
  git('init', '-q', '-b', 'main');
  commit('a.ts', 'const a = 1;\n');
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

async function runChanging(change: () => void) {
  const tracker = fakeTracker([]);
  const deps = { api: tracker.api, cwd: folder, runnerId: RUNNER, log: () => {}, describe: String };
  const send = await trackRunChanges(deps, job('r-1', 'MOB-1'));
  change();
  await send({ status: 'done' });
  return tracker.changes[0]?.diff ?? '';
}

describe("a run's changes are only what changed during the run", () => {
  it('leaves out edits and files that were there before it started', async () => {
    write('a.ts', 'const a = 2; // my own edit\n');
    write('notes.md', 'my private notes\n');
    git('add', 'a.ts');
    const status = git('status', '--porcelain');
    const diff = await runChanging(() => {
      write('b.ts', 'export const b = 1;\n');
      write('a.ts', 'const a = 3;\n');
    });
    expect(parseDiff(diff).map(({ path, status: kind }) => [path, kind])).toEqual([
      ['a.ts', 'modified'],
      ['b.ts', 'added'],
    ]);
    expect(diff).toContain('-const a = 2; // my own edit');
    expect(diff).not.toContain('notes');
    expect(diff).not.toContain('const a = 1;');
    // The real index is never written: what was staged stays staged, nothing more.
    write('a.ts', 'const a = 2; // my own edit\n');
    rmSync(join(folder, 'b.ts'));
    expect(git('status', '--porcelain')).toBe(status);
  });

  it("on a branch, shows the run's own work, not the branch's earlier commits", async () => {
    git('checkout', '-qb', 'ticket/pt-1');
    commit('earlier.ts', 'export const earlier = 1;\n');
    const diff = await runChanging(() => commit('c.ts', 'export const c = 1;\n'));
    expect(parseDiff(diff).map(({ path }) => path)).toEqual(['c.ts']);
  });
});
