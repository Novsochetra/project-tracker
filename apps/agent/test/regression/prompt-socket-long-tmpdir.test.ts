import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { askHelper } from '../../src/watch/permissionTool/askHelper';
import { openPromptSocket } from '../../src/watch/permissionTool/promptSocket';
import { createRunLoop } from '../../src/watch/runLoop';
import { fakeTracker, job, noAsks } from '../watch/fakeTracker';

// macOS keeps 104 bytes of a socket's path, the ending zero included.
const SOCKET_PATH_MAX = 103;

const root = mkdtempSync(join(tmpdir(), 'long-'));
const longBase = join(root, 'a'.repeat(60), 'b'.repeat(60));
mkdirSync(longBase, { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));
afterEach(() => vi.unstubAllEnvs());

const call = { tool_name: 'Bash', input: { command: 'ls' }, tool_use_id: 't-1' };
const answer = () => Promise.resolve({ behavior: 'deny' as const, message: 'No.' });

// PT-170: with a long TMPDIR macOS cut the socket's path, bound it outside the 0700 folder and
// never removed it, so the next run got EADDRINUSE; work() then threw, the run was never
// reported, the lane kept it as current and its step batcher's timer kept running.
describe('regression: the prompt socket under a long TMPDIR', () => {
  it('opens in a short 0700 folder that only this user reaches, and removes it', async () => {
    vi.stubEnv('TMPDIR', longBase);
    const socket = await openPromptSocket(answer);
    try {
      expect(Buffer.byteLength(socket.path)).toBeLessThanOrEqual(SOCKET_PATH_MAX);
      expect(statSync(dirname(socket.path)).mode & 0o777).toBe(0o700);
      expect(await askHelper(socket.path, call)).toEqual({ behavior: 'deny', message: 'No.' });
    } finally {
      socket.close();
    }
    expect(() => statSync(dirname(socket.path))).toThrow();
  });

  it('says why when the socket cannot open', async () => {
    const notAFolder = join(root, 'file');
    writeFileSync(notAFolder, '');
    vi.stubEnv('TMPDIR', notAFolder);
    await expect(openPromptSocket(answer)).rejects.toThrow(
      /^Couldn't open the socket Claude asks the phone through: /,
    );
  });

  it('ends the run failed with the reason, stops its steps and takes the next run', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1'), job('r-2', 'MOB-2')]);
    const end = vi.fn(() => Promise.resolve());
    const log: string[] = [];
    const reason = "Couldn't open the socket Claude asks the phone through: listen EADDRINUSE";
    const runClaude = vi
      .fn()
      .mockRejectedValueOnce(new Error(reason))
      .mockResolvedValueOnce({ code: 0, signal: null, output: '', results: [] });
    const lane = createRunLoop(
      {
        api: tracker.api,
        runClaude,
        runAsk: noAsks,
        log: (text) => log.push(text),
        describe: (error) => (error as Error).message,
        onProblem: vi.fn(),
        handBack: () => Promise.resolve(),
        signOfLife: () => () => undefined,
        stepsFor: () => ({ add: () => undefined, end }),
        usageOf: () => undefined,
      },
      { runnerId: 'runner-1', projectKey: 'MOB', kind: 'ticket' },
    );
    await lane.lookForWork();
    expect(tracker.ended).toEqual([
      { id: 'r-1', status: 'failed', error: `Claude Code could not start: ${reason}` },
      { id: 'r-2', status: 'done' },
    ]);
    expect(log.slice(0, 3)).toEqual([
      'Claude Code is working on MOB-1…',
      `MOB-1: Claude Code could not start: ${reason}`,
      'MOB-1: Claude Code stopped with an error.',
    ]);
    expect(end).toHaveBeenCalledTimes(2);
    expect(lane.currentRunId()).toBeUndefined();
  });
});
