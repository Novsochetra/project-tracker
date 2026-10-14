import { describe, expect, it } from 'vitest';
import { DEFAULT_ASK_OPTIONS, laneOf } from '../src';

describe('laneOf', () => {
  it.each(['edit', 'auto'] as const)('sends a %s question to the ticket lane', (mode) => {
    expect(laneOf('ask', { ...DEFAULT_ASK_OPTIONS, mode })).toBe('ticket');
  });

  it.each(['ask', 'plan'] as const)('keeps a %s question in the ask lane', (mode) => {
    expect(laneOf('ask', { ...DEFAULT_ASK_OPTIONS, mode })).toBe('ask');
  });

  it('keeps an ask from before options in the ask lane', () => {
    expect(laneOf('ask', null)).toBe('ask');
  });

  it('keeps a kind from a newer tracker out of both lanes', () => {
    expect(laneOf('later' as 'ticket', null)).toBe('later');
  });

  it.each(['ticket', 'batch'] as const)('sends a %s run to the ticket lane', (kind) => {
    expect(laneOf(kind, null)).toBe('ticket');
  });
});
