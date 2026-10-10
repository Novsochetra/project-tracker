import { existsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { askHelper, HELPER_GONE } from '../../../src/watch/permissionTool/askHelper';
import {
  CALL_CLOSED,
  openPromptSocket,
  RUN_STOPPED,
} from '../../../src/watch/permissionTool/promptSocket';

const call = { tool_name: 'Bash', input: { command: 'ls' }, tool_use_id: 't-1' };

describe('the prompt socket', () => {
  it("hands the tool's call to the helper and its decision back, in a folder only this user opens", async () => {
    const answer = vi.fn(() => Promise.resolve({ behavior: 'deny' as const, message: 'No.' }));
    const socket = await openPromptSocket(answer);
    try {
      expect(statSync(dirname(socket.path)).mode & 0o777).toBe(0o700);
      expect(await askHelper(socket.path, call)).toEqual({ behavior: 'deny', message: 'No.' });
      expect(answer).toHaveBeenCalledWith(call, expect.any(AbortSignal));
    } finally {
      socket.close();
    }
    expect(existsSync(dirname(socket.path))).toBe(false);
  });

  it('carries a large call whole', async () => {
    const content = 'x'.repeat(2_000_000);
    const socket = await openPromptSocket((args) =>
      Promise.resolve({ behavior: 'allow', updatedInput: (args as typeof call).input }),
    );
    try {
      const big = { ...call, input: { file_path: 'a.ts', content } };
      expect(await askHelper(socket.path, big)).toEqual({
        behavior: 'allow',
        updatedInput: big.input,
      });
    } finally {
      socket.close();
    }
  });

  it('stops the wait and denies when the run ends during it', async () => {
    let waiting: AbortSignal | undefined;
    const socket = await openPromptSocket(
      (_args, signal) =>
        new Promise((resolve) => {
          waiting = signal;
          signal.addEventListener('abort', () => resolve({ behavior: 'deny', message: 'Late.' }));
        }),
    );
    const asking = askHelper(socket.path, call);
    await vi.waitFor(() => expect(waiting).toBeDefined());
    socket.close();
    expect(waiting?.reason).toBe(RUN_STOPPED);
    expect(await asking).toEqual({ behavior: 'deny', message: HELPER_GONE });
  });

  it('tells the helper when Claude gives up on a call', async () => {
    let waiting: AbortSignal | undefined;
    const socket = await openPromptSocket((_args, signal) => {
      waiting = signal;
      return new Promise(() => undefined);
    });
    try {
      const giveUp = new AbortController();
      const asking = askHelper(socket.path, call, giveUp.signal);
      await vi.waitFor(() => expect(waiting).toBeDefined());
      giveUp.abort();
      expect(await asking).toEqual({ behavior: 'deny', message: HELPER_GONE });
      await vi.waitFor(() => expect(waiting?.reason).toBe(CALL_CLOSED));
    } finally {
      socket.close();
    }
  });

  it('denies when no helper is there', async () => {
    expect(await askHelper('/nowhere/prompt.sock', call)).toEqual({
      behavior: 'deny',
      message: HELPER_GONE,
    });
  });
});
