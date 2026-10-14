import { describe, expect, it } from 'vitest';
import { DEFAULT_ASK_OPTIONS, laneOf } from '../src';

describe('laneOf', () => {
  it.each(['edit', 'auto'] as const)('sends a %s question to the ticket lane', (mode) => {
    expect(laneOf('ask', { ...DEFAULT_ASK_OPTIONS, mode })).toBe('ticket');
  });

  it.each(['ask', 'plan'] as const)('keeps a %s question in the ask lane', (mode) => {
    expect(laneOf('ask', { ...DEFAULT_ASK_OPTIONS, mode })).toBe('ask');
  });
});
