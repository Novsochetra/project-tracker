import { describe, expect, it } from 'vitest';
import { resultOf } from '../../../src/watch/stream/claudeResult';

describe('resultOf', () => {
  it("reads a successful run's answer and session", () => {
    const event = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: ' Done. ',
      session_id: 's-1',
      total_cost_usd: 0.01,
    };
    expect(resultOf(event)).toEqual({ text: 'Done.', sessionId: 's-1', isError: false });
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
    });
  });

  it('is null for every other event', () => {
    for (const event of [null, 'result', { type: 'assistant' }, { type: 'system' }]) {
      expect(resultOf(event)).toBeNull();
    }
  });
});
