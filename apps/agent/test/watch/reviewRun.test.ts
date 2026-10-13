import { REVIEW_NOT_RECORDED, type RunJob } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createWatcher } from '../../src/watch/watcher';
import type { WatchApi } from '../../src/watch/watchApi';
import { fakeTracker, job, noAsks, reviewJob, RUNNER } from './fakeTracker';

const REPORT = 'TICKET: MOB-1\nSTATUS: done\nSUMMARY: Looks good.\nFILES: none\nNEXT: none';

const printed = (code: number, text: string): ClaudeExit => ({
  code,
  signal: null,
  output: text,
  results: [{ text, sessionId: undefined, isError: false }],
});

function watcherWith(api: WatchApi, exit: ClaudeExit) {
  const log: string[] = [];
  const runClaude = vi.fn((_job: RunJob) => Promise.resolve(exit));
  const watcher = createWatcher(
    { api, runClaude, runAsk: noAsks, log: (text) => log.push(text), retryDelay: () => 1 },
    { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
  );
  return { watcher, log, runClaude };
}

describe('a review run', () => {
  it('ends done once Claude has recorded the review, and hands back no report', async () => {
    const tracker = fakeTracker([reviewJob('r-1', 'MOB-1')]);
    tracker.ticket.category = 'reviewed';
    const { watcher, runClaude } = watcherWith(
      tracker.api,
      printed(0, `\`\`\`\n${REPORT}\n\`\`\``),
    );
    await watcher.lookForWork();
    expect(runClaude.mock.calls[0]?.[0].prompt).toBe('Review MOB-1');
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'done' }]);
    expect(tracker.reports).toEqual([]);
    expect(tracker.api.getTicket).toHaveBeenCalledWith('MOB-1', { fresh: true });
  });

  it('ends done when changes were requested and the ticket went back to To do', async () => {
    const tracker = fakeTracker([reviewJob('r-1', 'MOB-1')]);
    tracker.ticket.category = 'todo';
    await watcherWith(tracker.api, printed(0, 'Changes requested.')).watcher.lookForWork();
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'done' }]);
  });

  it('fails when the ticket is still in review after Claude finished', async () => {
    const tracker = fakeTracker([reviewJob('r-1', 'MOB-1')]);
    tracker.ticket.category = 'in_review';
    const { watcher, log } = watcherWith(tracker.api, printed(0, `\`\`\`\n${REPORT}\n\`\`\``));
    await watcher.lookForWork();
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'failed', error: REVIEW_NOT_RECORDED }]);
    expect(REVIEW_NOT_RECORDED).toBe("Claude didn't record a review.");
    expect(tracker.reports).toEqual([]);
    expect(log).toContain('MOB-1: Claude Code stopped with an error.');
  });

  it('keeps the reason when Claude Code itself failed', async () => {
    const tracker = fakeTracker([reviewJob('r-1', 'MOB-1')]);
    tracker.ticket.category = 'in_review';
    await watcherWith(tracker.api, printed(1, 'boom')).watcher.lookForWork();
    expect(tracker.ended).toEqual([
      { id: 'r-1', status: 'failed', error: 'Claude Code exited with 1.\nboom' },
    ]);
    expect(tracker.api.getTicket).not.toHaveBeenCalled();
  });

  it('ends done and says so when the tracker cannot show the ticket', async () => {
    const tracker = fakeTracker([reviewJob('r-1', 'MOB-1')]);
    vi.mocked(tracker.api.getTicket).mockRejectedValue(new Error('fetch failed'));
    const { watcher, log } = watcherWith(tracker.api, printed(0, 'Approved.'));
    await watcher.lookForWork();
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'done' }]);
    expect(log).toContain("Couldn't check the review on MOB-1: fetch failed");
  });

  it('leaves work runs as they were: their report goes on the ticket', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    tracker.ticket.category = 'in_review';
    await watcherWith(tracker.api, printed(0, `\`\`\`\n${REPORT}\n\`\`\``)).watcher.lookForWork();
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'done' }]);
    expect(tracker.reports).toEqual([{ text: REPORT, ticketKey: 'MOB-1' }]);
  });
});
