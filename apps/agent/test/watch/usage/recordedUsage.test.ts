import { describe, expect, it } from 'vitest';
import { finalResult } from '../../../src/watch/stream/claudeResult';
import { runUsageOf } from '../../../src/watch/usage/runUsage';
import { createSessionMarks } from '../../../src/watch/usage/sessionMarks';
import { askJob, job } from '../fakeTracker';
import { replayed } from '../recording';

const FRESH = [
  'ask-user-question',
  'background-sub-agent',
  'denied-by-hook',
  'denied-by-person',
  'max-turns',
  'sub-agent',
  'ticket-run',
];

// resumed-ask.jsonl is a follow-up of one question in the same folder; its session's previous run
// ended at this cost, with these tokens read.
const SESSION = 'b443b59d-c1b9-49cb-b9e1-219a9508b6f6';
const BEFORE = { costUsd: 0.00655407, readTokens: 4 + 48_567 + 30_295 };

describe('usage of recorded runs', () => {
  it.each(FRESH)('streams every token Claude Code counts in a fresh run (%s)', async (name) => {
    const exit = await replayed(name);
    expect(exit.readTokens).toBe(finalResult(exit.results)?.usage?.readTokens);
  });

  it("sends a ticket run's cost in micro-dollars, its turns and its time", async () => {
    const usage = runUsageOf(
      job('r-1', 'MOB-1'),
      await replayed('ticket-run'),
      createSessionMarks(),
    );
    expect(usage).toEqual({
      costMicros: 3_847,
      turns: 4,
      durationMs: 7_606,
      contextTokens: 38_272,
      contextWindow: 1_000_000,
      tokens: 114_163,
    });
  });

  it('adds up the turns and time of background work, and keeps the cost once', async () => {
    const exit = await replayed('background-sub-agent');
    const usage = runUsageOf(job('r-1', 'MOB-1'), exit, createSessionMarks());
    expect(usage).toEqual({
      costMicros: 8_719,
      turns: 3,
      durationMs: 9_146,
      contextTokens: 38_146,
      contextWindow: 1_000_000,
      tokens: 74_318 + 38_440,
    });
  });

  it('sends what a run that reached its turn limit took', async () => {
    const exit = await replayed('max-turns', 1);
    const usage = runUsageOf(job('r-1', 'MOB-1'), exit, createSessionMarks());
    expect(usage).toEqual({
      costMicros: 3_147,
      turns: 3,
      durationMs: 3_564,
      contextTokens: 37_689,
      contextWindow: 1_000_000,
      tokens: 75_494,
    });
  });

  it("takes a resumed session's earlier cost off a follow-up", async () => {
    const marks = createSessionMarks();
    marks.note(SESSION, { ...BEFORE, turns: 1, durationMs: 1 });
    const exit = await replayed('resumed-ask');
    expect(runUsageOf(askJob('r-2', 'chat', SESSION), exit, marks)).toEqual({
      costMicros: 564,
      turns: 1,
      durationMs: 2_527,
      contextTokens: 40_248,
      contextWindow: 1_000_000,
      tokens: 40_254,
    });
    expect(marks.get(SESSION)).toEqual({ costUsd: 0.007118, readTokens: 119_114 });
  });

  it("leaves out the cost of a follow-up whose session's earlier cost it never saw", async () => {
    const exit = await replayed('resumed-ask');
    const usage = runUsageOf(askJob('r-2', 'chat', SESSION), exit, createSessionMarks());
    expect(usage).toEqual({
      turns: 1,
      durationMs: 2_527,
      contextTokens: 40_248,
      contextWindow: 1_000_000,
      tokens: 40_254,
    });
  });

  it('sends nothing for a run with no result', () => {
    const exit = { code: null, signal: 'SIGTERM' as const, output: '', results: [] };
    expect(runUsageOf(job('r-1', 'MOB-1'), exit, createSessionMarks())).toBeUndefined();
  });

  it('drops a figure the tracker would refuse', () => {
    const usage = { costUsd: 0.5, turns: 2.5, durationMs: 1e300, readTokens: 1, tokens: -1 };
    const exit = {
      code: 0,
      signal: null,
      output: '',
      results: [{ text: 'Done.', sessionId: undefined, isError: false, usage }],
    };
    expect(runUsageOf(job('r-1', 'MOB-1'), exit, createSessionMarks())).toEqual({
      costMicros: 500_000,
    });
  });
});
