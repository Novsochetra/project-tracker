import { DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createWatcher } from '../../src/watch/watcher';
import { answered, askJob, fakeTracker, RUNNER } from './fakeTracker';

const SESSION = '11111111-2222-4333-8444-555555555555';

describe('the watcher with a chat question', () => {
  it('asks read-only Claude and hands back the answer, never as a ticket run', async () => {
    const tracker = fakeTracker([askJob('r-1', 'c0ffee00-chat', SESSION)]);
    const runClaude = vi.fn();
    const runAsk = vi.fn(() => Promise.resolve(answered('It lives in runQueue.ts.', SESSION)));
    const log: string[] = [];
    const watcher = createWatcher(
      { api: tracker.api, runClaude, runAsk, log: (text) => log.push(text) },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    await watcher.lookForWork();
    expect(runClaude).not.toHaveBeenCalled();
    expect(runAsk).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Question in c0ffee00-chat', resumeSessionId: SESSION }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(tracker.ended).toEqual([
      { id: 'r-1', status: 'done', answer: 'It lives in runQueue.ts.', sessionId: SESSION },
    ]);
    expect(tracker.reports).toEqual([]);
    expect(log).toContain('Claude Code is answering a question in chat c0ffee00…');
    expect(log).toContain('chat c0ffee00: Claude Code finished.');
  });

  it('sends what each answer took, without the earlier cost Claude Code carried over', async () => {
    const tracker = fakeTracker([
      askJob('r-1', 'c0ffee00-chat'),
      askJob('r-2', 'c0ffee00-chat', SESSION),
    ]);
    const exitOf = (costUsd: number, sessionTokens: number, readTokens: number): ClaudeExit => {
      const usage = { costUsd, turns: 2, durationMs: 5_000, readTokens: sessionTokens };
      const result = { text: 'Yes.', sessionId: SESSION, isError: false, usage };
      return { code: 0, signal: null, output: '', results: [result], readTokens };
    };
    const runAsk = vi
      .fn()
      .mockResolvedValueOnce(exitOf(0.3, 1_000, 1_000))
      .mockResolvedValueOnce(exitOf(0.5, 1_600, 600));
    const watcher = createWatcher(
      { api: tracker.api, runClaude: vi.fn(), runAsk, log: () => undefined },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    await watcher.lookForWork();
    expect(tracker.ended.map(({ id, usage }) => [id, usage])).toEqual([
      ['r-1', { costMicros: 300_000, turns: 2, durationMs: 5_000 }],
      ['r-2', { costMicros: 200_000, turns: 2, durationMs: 5_000 }],
    ]);
  });

  // PT-162: the chat's Stop cancels the run, and the helper must end Claude in either lane.
  it.each(['ask', 'edit'] as const)('stops Claude answering a %s question', async (mode) => {
    const tracker = fakeTracker([
      askJob('r-1', 'c0ffee00-chat', null, { ...DEFAULT_ASK_OPTIONS, mode }),
    ]);
    const runAsk = vi.fn(
      (_job: unknown, signal: AbortSignal) =>
        new Promise<ClaudeExit>((resolve) =>
          signal.addEventListener('abort', () =>
            resolve({ code: null, signal: 'SIGTERM', output: '', results: [] }),
          ),
        ),
    );
    const watcher = createWatcher(
      { api: tracker.api, runClaude: vi.fn(), runAsk, log: () => undefined },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    const working = watcher.lookForWork();
    await vi.waitFor(() => expect(runAsk).toHaveBeenCalled());
    watcher.onRunEvent({
      type: 'run',
      runId: 'r-1',
      runnerId: RUNNER,
      projectId: 'p',
      ticketId: null,
      chatId: 'c0ffee00-chat',
      status: 'cancelled',
    });
    await working;
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'cancelled' }]);
  });
});
