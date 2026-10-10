import { describe, expect, it, vi } from 'vitest';
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
});
