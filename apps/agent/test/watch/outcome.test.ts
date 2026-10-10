import { describe, expect, it } from 'vitest';
import { lastLines, outcomeOf } from '../../src/watch/outcome';

describe('lastLines', () => {
  it('keeps the end of long output from the start of a line', () => {
    expect(lastLines('first line\nsecond\nthird', 12)).toBe('third');
    expect(lastLines('  short  ')).toBe('short');
  });
});

describe('outcomeOf', () => {
  it('reads exit code 0 as done, a cancel as cancelled, anything else as failed', () => {
    expect(outcomeOf({ code: 0, signal: null, output: 'ok' }, false)).toEqual({ status: 'done' });
    expect(outcomeOf({ code: 143, signal: null, output: '' }, true)).toEqual({
      status: 'cancelled',
    });
    expect(outcomeOf({ code: 1, signal: null, output: 'boom' }, false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nboom',
    });
    expect(outcomeOf({ code: null, signal: null, output: 'spawn claude ENOENT' }, false)).toEqual({
      status: 'failed',
      error: 'Claude Code did not start.\nspawn claude ENOENT',
    });
    expect(outcomeOf({ code: null, signal: 'SIGKILL', output: '' }, false)).toEqual({
      status: 'failed',
      error: 'Claude Code was stopped (SIGKILL).',
    });
  });
});
