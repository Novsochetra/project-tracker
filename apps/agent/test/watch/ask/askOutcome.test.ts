import { CHAT_ANSWER_MAX } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { askOutcomeOf } from '../../../src/watch/ask/askOutcome';
import type { ClaudeResult } from '../../../src/watch/stream/claudeResult';

const SESSION = '11111111-2222-4333-8444-555555555555';

const said = (text: string, more: Partial<ClaudeResult> = {}): ClaudeResult => ({
  text,
  sessionId: SESSION,
  isError: false,
  ...more,
});

const exit = (code: number | null, result: ClaudeResult | ClaudeResult[] | null, output = '') => ({
  code,
  signal: null,
  output,
  results: result === null ? [] : [result].flat(),
});

describe('askOutcomeOf', () => {
  it('gives the answer and its session', () => {
    expect(askOutcomeOf(exit(0, said('It is in runQueue.ts.')), false)).toEqual({
      status: 'done',
      answer: 'It is in runQueue.ts.',
      sessionId: SESSION,
    });
  });

  it("answers with the last turn's result, after background work Claude started", () => {
    const started = said('I started the sub agent. I will tell you what it found.');
    const found = said('The sub agent found two files.');
    expect(askOutcomeOf(exit(0, [started, found]), false)).toMatchObject({
      status: 'done',
      answer: 'The sub agent found two files.',
    });
  });

  it('ends as the last turn ended, whichever turn failed', () => {
    const failed = said('API Error: overloaded', { isError: true });
    const answer = said('Here it is.');
    expect(askOutcomeOf(exit(0, [failed, answer]), false)).toMatchObject({ status: 'done' });
    expect(askOutcomeOf(exit(0, [answer, failed]), false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 0.\nAPI Error: overloaded',
    });
  });

  it('leaves out a session id that is not a UUID', () => {
    const result = said('Yes.', { sessionId: 'nope' });
    expect(askOutcomeOf(exit(0, result), false)).toEqual({ status: 'done', answer: 'Yes.' });
  });

  it('cuts an answer too long for the tracker and says so', () => {
    const outcome = askOutcomeOf(exit(0, said('x'.repeat(CHAT_ANSWER_MAX + 5))), false);
    expect(outcome.answer).toHaveLength(CHAT_ANSWER_MAX);
    expect(outcome.answer?.endsWith('(cut: the answer was too long for the tracker)')).toBe(true);
  });

  it('fails with what Claude said when it reports an error', () => {
    const result = said('Credit balance is too low', { isError: true });
    expect(askOutcomeOf(exit(1, result), false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nCredit balance is too low',
    });
  });

  it('fails when the result is an error, even with exit 0', () => {
    const result = said('Reached the maximum number of turns', { isError: true });
    expect(askOutcomeOf(exit(0, result), false)).toMatchObject({ status: 'failed' });
  });

  it('fails with the printed output when there is no result', () => {
    expect(askOutcomeOf(exit(2, null, 'error: unknown option'), false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 2.\nerror: unknown option',
    });
  });

  it('fails when Claude finished without an answer', () => {
    expect(askOutcomeOf(exit(0, said('')), false).status).toBe('failed');
  });

  it('is cancelled when the person cancelled, whatever was printed', () => {
    expect(askOutcomeOf(exit(0, said('Half')), true)).toEqual({ status: 'cancelled' });
  });
});
