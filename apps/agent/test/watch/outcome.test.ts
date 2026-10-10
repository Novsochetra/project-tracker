import type { RunJob } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { lastLines, outcomeOf, refusalOf } from '../../src/watch/outcome';

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

describe('lastLines', () => {
  it('keeps the end of long output from the start of a line', () => {
    expect(lastLines('first line\nsecond\nthird', 12)).toBe('third');
    expect(lastLines('  short  ')).toBe('short');
  });
});

describe('outcomeOf', () => {
  it('reads exit code 0 as done, a cancel as cancelled, anything else as failed', () => {
    expect(outcomeOf({ code: 0, output: 'ok' }, false)).toEqual({ status: 'done' });
    expect(outcomeOf({ code: 143, output: '' }, true)).toEqual({ status: 'cancelled' });
    expect(outcomeOf({ code: 1, output: 'boom' }, false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nboom',
    });
    expect(outcomeOf({ code: null, output: 'spawn claude ENOENT' }, false)).toEqual({
      status: 'failed',
      error: 'Claude Code did not start.\nspawn claude ENOENT',
    });
  });
});
