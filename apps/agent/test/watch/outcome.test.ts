import { describe, expect, it } from 'vitest';
import { lastLines, ticketOutcomeOf, type ClaudeExit } from '../../src/watch/outcome';
import type { ClaudeResult } from '../../src/watch/stream/claudeResult';

const exitOf = (
  code: number | null,
  output: string,
  results: ClaudeResult[] = [],
  signal: NodeJS.Signals | null = null,
): ClaudeExit => ({ code, signal, output, results });

const result = (text: string, isError = false): ClaudeResult => ({
  text,
  sessionId: undefined,
  isError,
});

describe('lastLines', () => {
  it('keeps the end of long output from the start of a line', () => {
    expect(lastLines('first line\nsecond\nthird', 12)).toBe('third');
    expect(lastLines('  short  ')).toBe('short');
  });
});

describe('ticketOutcomeOf', () => {
  it('reads exit code 0 as done, a cancel as cancelled, anything else as failed', () => {
    expect(ticketOutcomeOf(exitOf(0, 'ok'), false)).toEqual({ status: 'done' });
    expect(ticketOutcomeOf(exitOf(143, ''), true)).toEqual({ status: 'cancelled' });
    expect(ticketOutcomeOf(exitOf(1, 'boom'), false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nboom',
    });
    expect(ticketOutcomeOf(exitOf(null, 'spawn claude ENOENT'), false)).toEqual({
      status: 'failed',
      error: 'Claude Code did not start.\nspawn claude ENOENT',
    });
    expect(ticketOutcomeOf(exitOf(null, '', [], 'SIGKILL'), false)).toEqual({
      status: 'failed',
      error: 'Claude Code was stopped (SIGKILL).',
    });
  });

  it("says why from the last turn's failed result, not the report printed before it", () => {
    const output = 'TICKET: MOB-1\nSTATUS: done\nReached maximum number of turns (2)\n';
    const results = [
      result('TICKET: MOB-1\nSTATUS: done'),
      result('Reached maximum number of turns (2)', true),
    ];
    expect(ticketOutcomeOf(exitOf(1, output, results), false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nReached maximum number of turns (2)',
    });
  });

  it('fails a run whose last turn failed even when Claude Code exits with 0', () => {
    const results = [result('API Error: overloaded', true)];
    expect(ticketOutcomeOf(exitOf(0, 'API Error: overloaded\n', results), false)).toMatchObject({
      status: 'failed',
    });
    const wentOn = [result('API Error: overloaded', true), result('Done.')];
    expect(ticketOutcomeOf(exitOf(0, '', wentOn), false)).toEqual({ status: 'done' });
  });
});
