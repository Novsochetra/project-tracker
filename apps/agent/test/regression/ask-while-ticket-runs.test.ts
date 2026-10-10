import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createWatcher } from '../../src/watch/watcher';
import { askJob, fakeTracker, job, RUNNER } from '../watch/fakeTracker';

const answer = JSON.stringify({ result: 'In runQueue.ts.' });

// With one lane a question waited for the whole ticket run on the same Mac (PT-156 review).
describe('regression: a question while a ticket run works', () => {
  it('is answered at once, and the ticket run goes on', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1'), askJob('r-2', 'c0ffee00-chat')]);
    let finishTicket = () => undefined as void;
    const ticketRun = new Promise<ClaudeExit>((resolve) => {
      finishTicket = () => resolve({ code: 0, signal: null, output: '', stdout: '' });
    });
    const watcher = createWatcher(
      {
        api: tracker.api,
        runClaude: () => ticketRun,
        runAsk: () => Promise.resolve({ code: 0, signal: null, output: answer, stdout: answer }),
        log: () => undefined,
      },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    const working = watcher.lookForWork();
    await vi.waitFor(() =>
      expect(tracker.ended).toEqual([{ id: 'r-2', status: 'done', answer: 'In runQueue.ts.' }]),
    );
    finishTicket();
    await working;
    expect(tracker.ended.map(({ id, status }) => [id, status])).toEqual([
      ['r-2', 'done'],
      ['r-1', 'done'],
    ]);
  });
});
