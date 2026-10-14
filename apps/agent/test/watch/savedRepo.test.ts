import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetRepo, restoreRepo, saveRepo } from '../../src/watch/gitActions/savedRepo';

let folder: string;

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const write = (file: string, text: string) => writeFileSync(join(folder, file), text);

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'tracker-saved-repo-'));
  git('init', '-q', '-b', 'main');
  write('a.ts', '1\n');
  write('p.ts', 'x\n');
  git('add', '.');
  git('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init');
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

describe("a failed commit's restore (PT-237 review)", () => {
  it("puts back only the picked files' entries, and keeps what the person staged meanwhile", async () => {
    write('p.ts', 'X\n');
    git('add', 'p.ts');
    write('p.ts', 'X\nY\n');
    const saved = await saveRepo({ cwd: folder, signal: AbortSignal.timeout(10_000) });
    write('a.ts', '2\n');
    write('new.ts', 'n\n');
    git('add', 'a.ts', 'p.ts', 'new.ts');
    write('mine.ts', 'mine\n');
    git('add', 'mine.ts');
    await restoreRepo(folder, saved, { created: null, paths: ['a.ts', 'p.ts', 'new.ts'] });
    await forgetRepo(saved);
    expect(git('status', '--porcelain').split('\n').filter(Boolean)).toEqual([
      ' M a.ts',
      'A  mine.ts',
      'MM p.ts',
      '?? new.ts',
    ]);
    expect(git('show', ':p.ts')).toBe('X\n');
  });
});
