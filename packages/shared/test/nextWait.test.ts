import { describe, expect, it } from 'vitest';
import { QUESTION_WAIT_MS } from '../src/domain/ticketQuestion';
import { nextWaitMs } from '../src/logic/nextWait';

describe('the next wait of a long poll', () => {
  it('waits at most one wait, and never past the deadline', () => {
    expect(nextWaitMs(100_000, 0)).toBe(QUESTION_WAIT_MS);
    expect(nextWaitMs(100_000, 90_000)).toBe(10_000);
    expect(nextWaitMs(100_000, 120_000)).toBe(0);
  });
});
