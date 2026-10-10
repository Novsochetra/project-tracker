import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createWatcher } from '../../src/watch/watcher';
import { answered, askJob, fakeTracker, job, RUNNER } from '../watch/fakeTracker';

const SESSION = '11111111-2222-4333-8444-555555555555';

// An Edit question changes the folder, so two Claudes would edit one tree at once if it ran beside
// a ticket run (PT-160).
describe('regression: an Edit question while a ticket run works', () => {
  it('waits for the ticket run, then hands its answer back to the chat', async () => {
    const editAsk = askJob('r-2', 'c0ffee00-chat', null, { model: 'default', mode: 'edit' });
    const tracker = fakeTracker([job('r-1', 'MOB-1'), editAsk]);
    let finishTicket = () => undefined as void;
    const ticketRun = new Promise<ClaudeExit>((resolve) => {
      finishTicket = () => resolve({ code: 0, signal: null, output: '', results: [] });
    });
    const runAsk = vi.fn(() => Promise.resolve(answered('Renamed it.', SESSION)));
    const log: string[] = [];
    const watcher = createWatcher(
      { api: tracker.api, runClaude: () => ticketRun, runAsk, log: (text) => log.push(text) },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    const working = watcher.lookForWork();
    await vi.waitFor(() => expect(log).toContain('Claude Code is working on MOB-1…'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runAsk).not.toHaveBeenCalled();
    expect(tracker.ended).toEqual([]);
    finishTicket();
    await working;
    expect(runAsk).toHaveBeenCalledTimes(1);
    expect(tracker.ended).toEqual([
      { id: 'r-1', status: 'done' },
      { id: 'r-2', status: 'done', answer: 'Renamed it.', sessionId: SESSION },
    ]);
    expect(tracker.reports).toEqual([]);
    expect(log).toContain('Claude Code is answering a question in chat c0ffee00…');
  });
});
