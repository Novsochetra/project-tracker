import { describe, expect, it } from 'vitest';
import { resultOf } from '../../../src/watch/stream/claudeResult';

const NO_USAGE = {
  costUsd: undefined,
  turns: undefined,
  durationMs: undefined,
  readTokens: undefined,
};

describe('resultOf', () => {
  it("reads a successful run's answer and session", () => {
    const event = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: ' Done. ',
      session_id: 's-1',
    };
    expect(resultOf(event)).toEqual({
      text: 'Done.',
      sessionId: 's-1',
      isError: false,
      usage: NO_USAGE,
    });
  });

  it("reads a failed run's errors, which come without a result", () => {
    const event = {
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      errors: ['Stream closed', 42, 'Try again'],
    };
    expect(resultOf(event)).toEqual({
      text: 'Stream closed\nTry again',
      sessionId: undefined,
      isError: true,
      usage: NO_USAGE,
    });
  });

  it("reads Claude Code's cost, turns and time, and every token its models read", () => {
    const event = {
      type: 'result',
      result: 'Done.',
      total_cost_usd: 0.84,
      num_turns: 23,
      duration_ms: 361_000,
      modelUsage: {
        'claude-opus': { inputTokens: 4, cacheReadInputTokens: 100, cacheCreationInputTokens: 20 },
        'claude-haiku': { inputTokens: 1, outputTokens: 900, cacheReadInputTokens: 'x' },
      },
    };
    expect(resultOf(event)?.usage).toEqual({
      costUsd: 0.84,
      turns: 23,
      durationMs: 361_000,
      readTokens: 125,
    });
  });

  it('drops figures that are not numbers of zero or more', () => {
    const event = {
      type: 'result',
      total_cost_usd: '0.84',
      num_turns: -1,
      duration_ms: Number.NaN,
      modelUsage: {},
    };
    expect(resultOf(event)?.usage).toEqual(NO_USAGE);
  });

  it('is null for every other event', () => {
    for (const event of [null, 'result', { type: 'assistant' }, { type: 'system' }]) {
      expect(resultOf(event)).toBeNull();
    }
  });
});
