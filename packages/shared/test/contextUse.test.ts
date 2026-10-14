import { describe, expect, it } from 'vitest';
import {
  contextLevel,
  contextPercent,
  contextUseOf,
  readContext,
  turnTokensOf,
  type ContextReading,
} from '../src/logic/contextUse';
import { streamEvents } from './fixtures/streamJson';

const readAll = (events: unknown[]): ContextReading => events.reduce(readContext, {});

const message = (usage: object, extra: object = {}) => ({
  type: 'assistant',
  message: { model: 'claude-opus-5-5', usage },
  parent_tool_use_id: null,
  ...extra,
});

const result = (modelUsage: object) => ({ type: 'result', modelUsage });

const compaction = (metadata: object) => ({
  type: 'system',
  subtype: 'compact_boundary',
  compact_metadata: { trigger: 'auto', pre_tokens: 180_000, ...metadata },
});

describe('readContext', () => {
  it("takes the last main message's input, cache reads and cache writes, and the model's window", () => {
    expect(contextUseOf(readAll(streamEvents('ticket-run')))).toEqual({
      used: 2 + 37_670 + 600,
      window: 1_000_000,
    });
  });

  it("leaves out a sub agent's messages, which have a context of their own", () => {
    expect(contextUseOf(readAll(streamEvents('sub-agent')))).toEqual({
      used: 2 + 38_897 + 1_338,
      window: 1_000_000,
    });
  });

  it('starts again from what a compaction left', () => {
    const events = [
      message({ input_tokens: 5, cache_read_input_tokens: 170_000 }),
      compaction({ post_tokens: 12_000 }),
      result({ 'claude-opus-5-5': { contextWindow: 200_000 } }),
    ];
    expect(contextUseOf(readAll(events))).toEqual({ used: 12_000, window: 200_000 });
  });

  it('counts a compaction that says nothing of what it left as empty, until the next message', () => {
    const compacted = [message({ input_tokens: 170_000 }), compaction({})];
    expect(readAll(compacted).used).toBe(0);
    expect(readAll([...compacted, message({ cache_read_input_tokens: 9_000 })]).used).toBe(9_000);
  });

  it("takes the window of the message's model, under a key with a suffix too", () => {
    const events = [
      message({ input_tokens: 1_000 }),
      result({
        'claude-haiku-5-5': { contextWindow: 200_000 },
        'claude-opus-5-5[1m]': { contextWindow: 1_000_000 },
      }),
    ];
    expect(readAll(events).window).toBe(1_000_000);
  });

  it('falls back to the widest window when no key names the model', () => {
    const events = [
      message({ input_tokens: 1_000 }),
      result({ 'opus-alias': { contextWindow: 400_000 }, other: { contextWindow: 200_000 } }),
    ];
    expect(readAll(events).window).toBe(400_000);
  });

  it('knows no context without a message or without a window', () => {
    expect(contextUseOf(readAll([result({ 'claude-opus-5-5': { contextWindow: 1 } })]))).toBe(
      undefined,
    );
    expect(contextUseOf(readAll([message({ input_tokens: 9 }), result({})]))).toBeUndefined();
    expect(contextUseOf(readAll(['noise', null, { type: 'user' }]))).toBeUndefined();
  });
});

describe('contextPercent and contextLevel', () => {
  it('rounds down and stops at 100', () => {
    expect(contextPercent({ used: 79_999, window: 100_000 })).toBe(79);
    expect(contextPercent({ used: 300_000, window: 200_000 })).toBe(100);
    expect(contextPercent({ used: 5, window: 0 })).toBe(0);
  });

  it('turns full from 80% and critical from 95%', () => {
    expect([79, 80, 94, 95, 100].map(contextLevel)).toEqual([
      'ok',
      'full',
      'full',
      'critical',
      'critical',
    ]);
  });
});

describe('turnTokensOf', () => {
  it("adds up what the turn's result says Claude read and wrote", () => {
    const events = streamEvents('ticket-run');
    expect(events.map(turnTokensOf).filter((tokens) => tokens !== undefined)).toEqual([
      6 + 101_359 + 11_887 + 911,
    ]);
  });

  it('knows none without a usage', () => {
    expect(turnTokensOf({ type: 'result' })).toBeUndefined();
    expect(turnTokensOf(message({ input_tokens: 1 }))).toBeUndefined();
  });
});
