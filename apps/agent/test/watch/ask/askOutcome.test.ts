import { CHAT_ANSWER_MAX } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { askOutcomeOf } from '../../../src/watch/ask/askOutcome';

const SESSION = '11111111-2222-4333-8444-555555555555';

const exit = (code: number | null, stdout: string, output = stdout) => ({
  code,
  signal: null,
  output,
  stdout,
});
const json = (value: object) => JSON.stringify(value);

describe('askOutcomeOf', () => {
  it('gives the answer and its session', () => {
    const stdout = json({
      type: 'result',
      is_error: false,
      result: ' It is in runQueue.ts. ',
      session_id: SESSION,
    });
    expect(askOutcomeOf(exit(0, stdout), false)).toEqual({
      status: 'done',
      answer: 'It is in runQueue.ts.',
      sessionId: SESSION,
    });
  });

  it('reads the JSON line after other output and leaves out a session id that is not a UUID', () => {
    const stdout = `warming up\n${json({ result: 'Yes.', session_id: 'nope' })}\n`;
    expect(askOutcomeOf(exit(0, stdout), false)).toEqual({ status: 'done', answer: 'Yes.' });
  });

  it('cuts an answer too long for the tracker and says so', () => {
    const outcome = askOutcomeOf(exit(0, json({ result: 'x'.repeat(CHAT_ANSWER_MAX + 5) })), false);
    expect(outcome.answer).toHaveLength(CHAT_ANSWER_MAX);
    expect(outcome.answer?.endsWith('(cut: the answer was too long for the tracker)')).toBe(true);
  });

  it('fails with what Claude said when it reports an error', () => {
    const stdout = json({ is_error: true, result: 'Credit balance is too low' });
    expect(askOutcomeOf(exit(1, stdout), false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 1.\nCredit balance is too low',
    });
  });

  it('fails with the printed output when there is no JSON', () => {
    expect(askOutcomeOf(exit(2, '', 'error: unknown option'), false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 2.\nerror: unknown option',
    });
  });

  it('fails when Claude finished without an answer', () => {
    expect(askOutcomeOf(exit(0, json({ result: '  ' })), false).status).toBe('failed');
  });

  it('is cancelled when the person cancelled, whatever was printed', () => {
    expect(askOutcomeOf(exit(0, json({ result: 'Half' })), true)).toEqual({ status: 'cancelled' });
  });
});
