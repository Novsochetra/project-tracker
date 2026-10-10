import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createWatcher } from '../../src/watch/watcher';
import { askJob, fakeTracker, RUNNER } from './fakeTracker';

const SESSION = '11111111-2222-4333-8444-555555555555';
const answered = (result: string): ClaudeExit => {
  const stdout = JSON.stringify({ result, session_id: SESSION });
  return { code: 0, signal: null, output: stdout, stdout };
};

describe('the watcher with a chat question', () => {
  it('asks read-only Claude and hands back the answer, never as a ticket run', async () => {
    const tracker = fakeTracker([askJob('r-1', 'c0ffee00-chat', SESSION)]);
    const runClaude = vi.fn();
    const runAsk = vi.fn(() => Promise.resolve(answered('It lives in runQueue.ts.')));
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
    );
    expect(tracker.ended).toEqual([
      { id: 'r-1', status: 'done', answer: 'It lives in runQueue.ts.', sessionId: SESSION },
    ]);
    expect(tracker.reports).toEqual([]);
    expect(log).toContain('Claude Code is answering a question in chat c0ffee00…');
    expect(log).toContain('chat c0ffee00: Claude Code finished.');
  });

  // PT-162: the chat's Stop cancels the run, and the helper must end Claude in either lane.
  it.each(['ask', 'edit'] as const)('stops Claude answering a %s question', async (mode) => {
    const tracker = fakeTracker([askJob('r-1', 'c0ffee00-chat', null, { model: 'default', mode })]);
    const runAsk = vi.fn(
      (_job: unknown, signal: AbortSignal) =>
        new Promise<ClaudeExit>((resolve) =>
          signal.addEventListener('abort', () =>
            resolve({ code: null, signal: 'SIGTERM', output: '', stdout: '' }),
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
