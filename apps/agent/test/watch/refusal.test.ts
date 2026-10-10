import type { RunJob } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { refusalOf } from '../../src/watch/refusal';

const job = (ticketKey: string): RunJob => ({
  prompt: 'Go',
  run: {
    id: 'r-1',
    ticketKey,
    runnerId: 'x',
    runnerName: 'Mac',
    status: 'running',
    error: null,
    createdAt: 1,
    startedAt: 2,
    endedAt: null,
  },
});

describe('refusalOf', () => {
  it("refuses a ticket outside this helper's project, even one whose key starts the same", () => {
    expect(refusalOf(job('MOB-3'), 'MOB')).toBeUndefined();
    expect(refusalOf(job('MOBILE-3'), 'MOB')).toBe(
      'This helper only runs MOB tickets, not MOBILE-3.',
    );
  });
});
