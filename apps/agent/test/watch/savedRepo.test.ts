import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToolStopped } from '../../src/watch/git/runTool';
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
    await restoreRepo(folder, saved, {
      created: null,
      paths: ['a.ts', 'p.ts', 'new.ts'],
      stopped: null,
    });
    await forgetRepo(saved);
    expect(git('status', '--porcelain').split('\n').filter(Boolean)).toEqual([
      ' M a.ts',
      'A  mine.ts',
      'MM p.ts',
      '?? new.ts',
    ]);
    expect(git('show', ':p.ts')).toBe('X\n');
  });

  const lock = () => join(folder, '.git/index.lock');
  const lockAt = (ms: number) => {
    writeFileSync(lock(), '');
    utimesSync(lock(), ms / 1000, ms / 1000);
  };

  it("leaves another git's lock alone and says git is busy when it can't switch back", async () => {
    const saved = await saveRepo({ cwd: folder, signal: AbortSignal.timeout(10_000) });
    git('switch', '-q', '--create', 'chat/x');
    const start = Date.now();
    lockAt(start + 5_000);
    const stopped = new ToolStopped(start, start + 1_000);
    const back = await restoreRepo(folder, saved, { created: 'chat/x', paths: ['a.ts'], stopped });
    expect(back).toBe(false);
    expect(existsSync(lock())).toBe(true);
    rmSync(lock());
    expect(
      await restoreRepo(folder, saved, { created: 'chat/x', paths: ['a.ts'], stopped: null }),
    ).toBe(true);
    expect(git('branch', '--show-current').trim()).toBe('main');
    await forgetRepo(saved);
  });

  it('removes the lock its own git left when it had to be killed', async () => {
    const saved = await saveRepo({ cwd: folder, signal: AbortSignal.timeout(10_000) });
    git('switch', '-q', '--create', 'chat/x');
    const start = Date.now();
    lockAt(start + 500);
    const stopped = new ToolStopped(start, start + 1_000);
    const back = await restoreRepo(folder, saved, { created: 'chat/x', paths: ['a.ts'], stopped });
    expect(back).toBe(true);
    expect(existsSync(lock())).toBe(false);
    expect(git('branch', '--list').trim()).toBe('* main');
    await forgetRepo(saved);
  });

  it('never removes a lock when git exited at SIGTERM', async () => {
    const saved = await saveRepo({ cwd: folder, signal: AbortSignal.timeout(10_000) });
    const start = Date.now();
    lockAt(start + 500);
    const stopped = new ToolStopped(start, null);
    await restoreRepo(folder, saved, { created: null, paths: ['a.ts'], stopped });
    expect(existsSync(lock())).toBe(true);
    await forgetRepo(saved);
  });
});
