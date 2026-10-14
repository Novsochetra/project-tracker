import { describe, expect, it } from 'vitest';
import { contextUseOf, readContext, type ContextReading } from '../../src/logic/contextUse';

const readAll = (events: unknown[]): ContextReading => events.reduce(readContext, {});

const ZERO = { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const real = {
  type: 'assistant',
  parent_tool_use_id: null,
  message: {
    model: 'claude-opus-5-5',
    usage: { input_tokens: 4, cache_read_input_tokens: 190_000 },
  },
};
const result = { type: 'result', modelUsage: { 'claude-opus-5-5': { contextWindow: 200_000 } } };

// Claude Code makes these up itself (an API error such as "Prompt is too long", "No response
// requested."), with no call behind them, so they say nothing about the context.
describe('regression: a synthetic last message keeps the context full', () => {
  it.each([
    ['a <synthetic> model', { model: '<synthetic>', usage: ZERO }, {}],
    ['an API error', { model: 'claude-opus-5-5', usage: ZERO }, { error: 'invalid_request' }],
  ])('skips a message with %s', (_name, message, extra) => {
    const synthetic = { type: 'assistant', parent_tool_use_id: null, message, ...extra };
    expect(contextUseOf(readAll([real, synthetic, result]))).toEqual({
      used: 190_004,
      window: 200_000,
    });
  });
});
