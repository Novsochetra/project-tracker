import { describe, expect, it } from 'vitest';
import { createWatcher } from '../../src/watch/watcher';
import { answered, fakeTracker, job, noAsks, RUNNER } from '../watch/fakeTracker';

const REPORT = [
  'TICKET: MOB-1',
  'STATUS: done',
  'SUMMARY: Fixed the crash.',
  'FILES: src/app.ts',
  'NEXT: none',
].join('\n');

// A broken tracker MCP left Claude with no tools: it did the work and printed its report, the run
// ended as "Claude Code finished", and the ticket stayed empty and in To do (PT-155, AWP-3).
describe('a run whose Claude had no tracker tools', () => {
  it('puts the printed report on the ticket', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    const log: string[] = [];
    const watcher = createWatcher(
      {
        api: tracker.api,
        log: (text) => log.push(text),
        runClaude: () => Promise.resolve(answered(`Working…\n\n${REPORT}`)),
        runAsk: noAsks,
      },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    await watcher.lookForWork();
    expect(tracker.reports).toEqual([{ text: REPORT, ticketKey: 'MOB-1' }]);
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'done' }]);
    expect(log).toContain("Put Claude's report on MOB-1.");
  });
});
