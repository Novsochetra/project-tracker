import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watch } from '../../src/watch/watch';
import { memoryStore } from '../memoryStore';
import { installFakeClaude } from '../watch/fakeClaude';

const PROMPTLY_MS = 5_000;

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// PT-189 review: `claude mcp list` can take up to a minute, and a helper stopped (SIGTERM under
// launchd or systemd) while one ran stayed alive until it ended. The start's list and the
// 5-minute refresh run the same command.
describe('regression: stopping the helper while claude mcp list runs', () => {
  const fake = installFakeClaude();
  const path = process.env.PATH;
  let pid = 0;

  afterEach(() => {
    process.env.PATH = path;
    delete process.env.FAKE_MCP;
    if (pid && alive(pid)) process.kill(pid);
    fake.remove();
  });

  it('ends the list and exits promptly', async () => {
    process.env.PATH = `${fake.dir}:${path}`;
    process.env.FAKE_MCP = 'slow';
    const config = mkdtempSync(join(tmpdir(), 'watch-config-'));
    const lines: string[] = [];
    let stop = () => undefined as void;
    const watching = watch(
      { url: 'http://127.0.0.1:9', json: false, help: false, version: false },
      { keepAwake: false },
      {
        env: {},
        store: Object.assign(memoryStore(), { path: join(config, 'config.json') }),
        cwd: realpathSync(mkdtempSync(join(tmpdir(), 'slow-mcp-'))),
        stdout: (text) => lines.push(text),
        write: () => undefined,
        untilStopped: () => new Promise((resolve) => (stop = resolve)),
      },
    );
    const pidFile = join(fake.dir, 'mcp-list.pid');
    await vi.waitFor(() => expect(existsSync(pidFile)).toBe(true), { timeout: 10_000 });
    pid = Number(readFileSync(pidFile, 'utf8'));
    stop();
    const late = new Promise((resolve) => setTimeout(() => resolve('still running'), PROMPTLY_MS));
    expect(await Promise.race([watching, late])).toBeUndefined();
    await vi.waitFor(() => expect(alive(pid)).toBe(false), { timeout: 2_000 });
    expect(lines).toEqual([]);
  }, 20_000);
});
