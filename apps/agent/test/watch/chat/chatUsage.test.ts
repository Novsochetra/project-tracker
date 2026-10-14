import { describe, expect, it } from 'vitest';
import type { ClaudeExit } from '../../../src/watch/outcome';
import { runUsageOf } from '../../../src/watch/usage/runUsage';
import { createSessionMarks } from '../../../src/watch/usage/sessionMarks';
import { askJob } from '../fakeTracker';
import { SESSION } from './fakeChatChild';

const turn = (costUsd: number, sessionTokens: number, readTokens: number): ClaudeExit => ({
  code: null,
  signal: null,
  turnEnded: true,
  output: '',
  results: [
    {
      text: 'Yes.',
      sessionId: SESSION,
      isError: false,
      usage: { costUsd, turns: 1, durationMs: 1_000, readTokens: sessionTokens },
    },
  ],
  readTokens,
});

// In a chat's open process each result carries the running total_cost_usd and modelUsage of all
// its turns (Claude Code 2.1.299's own description), so a later turn sends only its own share.
describe('the usage of turns of one open chat process', () => {
  it("takes the earlier turns' cost off each later turn", () => {
    const marks = createSessionMarks();
    const usageOf = (id: string, resume: string | null, exit: ClaudeExit) =>
      runUsageOf(askJob(id, 'chat-1', resume), exit, marks)?.costMicros;
    expect(usageOf('r-1', null, turn(0.1, 1_000, 1_000))).toBe(100_000);
    expect(usageOf('r-2', SESSION, turn(0.25, 2_500, 1_500))).toBe(150_000);
    // A WebFetch reads with a small model it doesn't stream, so its tokens show only in the total.
    expect(usageOf('r-3', SESSION, turn(0.4, 4_000, 1_400))).toBe(150_000);
  });
});
