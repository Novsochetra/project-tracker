import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTool } from '../../src/watch/git/runTool';

const folder = mkdtempSync(join(tmpdir(), 'tracker-run-tool-'));

afterEach(() => rmSync(join(folder, 'pid'), { force: true }));

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('runTool', () => {
  it('passes arguments as they are, with no shell', async () => {
    const out = await runTool('printf', ['%s|', '$(whoami)', 'a b;c'], {
      cwd: folder,
      signal: AbortSignal.timeout(5_000),
    });
    expect(out).toMatchObject({ code: 0, out: '$(whoami)|a b;c|' });
  });

  it('stops what the program started too at its deadline', async () => {
    const script = `sleep 30 & echo $! > pid; wait`;
    const run = runTool('sh', ['-c', script], { cwd: folder, signal: AbortSignal.timeout(300) });
    await expect(run).rejects.toThrow('Stopped at its deadline.');
    const pid = Number(readFileSync(join(folder, 'pid'), 'utf8'));
    await vi.waitFor(() => expect(alive(pid)).toBe(false));
  });
});
