import { describe, expect, it } from 'vitest';
import {
  DECLINED,
  DENIED,
  decisionOf,
  NO_ANSWER,
  RUN_ENDED,
} from '../../../src/watch/prompts/decisionOf';
import { permissionRequest, QUESTION_INPUT, questionRequest } from './requests';

const bash = { toolName: 'Bash', input: { command: 'npm test', description: 'Test' } };
const question = { toolName: 'AskUserQuestion', input: QUESTION_INPUT };

describe('decisionOf', () => {
  it("allows a permission the person allowed with Claude's own input", () => {
    const request = permissionRequest({ status: 'answered', decision: 'allow' });
    expect(decisionOf(bash, request)).toEqual({ behavior: 'allow', updatedInput: bash.input });
  });

  it('denies a permission the person denied, telling Claude to go on without it', () => {
    const request = permissionRequest({ status: 'answered', decision: 'deny' });
    expect(decisionOf(bash, request)).toEqual({ behavior: 'deny', message: DENIED });
    expect(DENIED).toBe('The person said no to this from their phone. Go on without it.');
  });

  it('gives Claude the answers under its own question texts', () => {
    const request = questionRequest({
      status: 'answered',
      decision: 'allow',
      answers: ['Green', 'Large, I think'],
    });
    expect(decisionOf(question, request)).toEqual({
      behavior: 'allow',
      updatedInput: {
        ...QUESTION_INPUT,
        answers: {
          'Which color should the button be?': 'Green',
          'Which size?': 'Large, I think',
        },
      },
    });
  });

  it("keys an answer by the tracker's copy when Claude's question has no text", () => {
    const request = questionRequest({ status: 'answered', decision: 'allow', answers: ['Red'] });
    const call = { toolName: 'AskUserQuestion', input: { questions: [{}] } };
    const decision = decisionOf(call, request);
    expect(decision).toMatchObject({
      updatedInput: { answers: { 'Which color should the button be?': 'Red' } },
    });
  });

  it('denies a declined question, one nobody answered and one whose run ended', () => {
    const declined = questionRequest({ status: 'answered', decision: 'deny' });
    expect(decisionOf(question, declined)).toEqual({ behavior: 'deny', message: DECLINED });
    expect(decisionOf(bash, permissionRequest({ status: 'expired' }))).toEqual({
      behavior: 'deny',
      message: NO_ANSWER,
    });
    expect(NO_ANSWER).toContain('within 30 minutes');
    expect(decisionOf(bash, permissionRequest({ status: 'cancelled' }))).toEqual({
      behavior: 'deny',
      message: RUN_ENDED,
    });
  });
});
