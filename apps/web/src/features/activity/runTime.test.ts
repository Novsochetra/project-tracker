import type { ActivityRun } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { formatElapsed, limitText, runTimeText } from './runTime';

const MINUTE = 60_000;
const NOW = 10_000_000;

const run = (overrides: Partial<ActivityRun>): ActivityRun => ({
  runId: 'r-1',
  batchId: null,
  projectKey: 'MOB',
  projectName: 'Mobile',
  ticketKey: 'MOB-1',
  ticketTitle: 'Crash',
  state: 'running',
  startedAt: NOW - 5 * MINUTE,
  createdAt: NOW - 9 * MINUTE,
  ...overrides,
});

describe('formatElapsed', () => {
  it.each([
    [0, 'under 1m'],
    [-5000, 'under 1m'],
    [59_999, 'under 1m'],
    [MINUTE, '1m'],
    [59 * MINUTE, '59m'],
    [60 * MINUTE, '1h 0m'],
    [135 * MINUTE, '2h 15m'],
  ])('writes %i ms as %s', (ms, text) => {
    expect(formatElapsed(ms)).toBe(text);
  });
});

describe('runTimeText', () => {
  it('times a running run from its start', () => {
    expect(runTimeText(run({}), NOW)).toBe('5m');
  });

  it('times a waiting run from when it was queued', () => {
    expect(runTimeText(run({ state: 'waiting', startedAt: null }), NOW)).toBe('waiting 9m');
  });

  it('says when a failed run started', () => {
    expect(runTimeText(run({ state: 'failed' }), NOW)).toBe('5m ago');
  });
});

describe('limitText', () => {
  it('joins the running count and the limit', () => {
    expect(limitText(3, 5)).toBe('3 running now · limit 5');
  });
});
