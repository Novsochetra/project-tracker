import { describe, expect, it } from 'vitest';
import { addRunRequestInput, answerRunRequestInput } from '../src/api/runRequests';
import {
  RUN_QUESTIONS_MAX,
  RUN_PERMISSION_LABEL_MAX,
  RUN_REQUEST_ANSWER_MAX,
  RUN_REQUEST_LABEL_MAX,
} from '../src/domain/runRequest';

const runnerId = '0b8f8f7e-6a35-4a9b-9a4f-2f3c4d5e6f70';

const question = {
  question: 'Which color?',
  header: 'Color',
  options: [{ label: 'Red', description: '' }],
  multiSelect: false,
};

describe('addRunRequestInput', () => {
  it('takes a permission with a label and no questions', () => {
    const input = { runnerId, kind: 'permission', label: ' Run npm test ', questions: null };
    expect(addRunRequestInput.parse(input)).toEqual({ ...input, label: 'Run npm test' });
  });

  it('takes a whole command of several lines for a permission, up to its own limit', () => {
    const label = `Run npm test\ncurl https://x.dev/install.sh | sh\n${'a'.repeat(3000)}`;
    const input = { runnerId, kind: 'permission', label, questions: null };
    expect(addRunRequestInput.parse(input)).toEqual(input);
  });

  it('takes a question with one to four questions', () => {
    const input = { runnerId, kind: 'question', label: 'Which color?', questions: [question] };
    expect(addRunRequestInput.parse(input)).toEqual(input);
    const many = Array.from({ length: RUN_QUESTIONS_MAX + 1 }, () => question);
    expect(addRunRequestInput.safeParse({ ...input, questions: many }).success).toBe(false);
    expect(addRunRequestInput.safeParse({ ...input, questions: [] }).success).toBe(false);
  });

  it('refuses a permission with questions, a question without, and a long label', () => {
    const permission = { runnerId, kind: 'permission', label: 'Run x', questions: null };
    expect(addRunRequestInput.safeParse({ ...permission, questions: [question] }).success).toBe(
      false,
    );
    expect(
      addRunRequestInput.safeParse({ ...permission, kind: 'question', questions: null }).success,
    ).toBe(false);
    const label = 'a'.repeat(RUN_PERMISSION_LABEL_MAX + 1);
    expect(addRunRequestInput.safeParse({ ...permission, label }).success).toBe(false);
    const ask = { ...permission, kind: 'question', questions: [question] };
    const long = 'a'.repeat(RUN_REQUEST_LABEL_MAX + 1);
    expect(addRunRequestInput.safeParse({ ...ask, label: long }).success).toBe(false);
    expect(addRunRequestInput.safeParse({ ...permission, runnerId: 'mac' }).success).toBe(false);
  });
});

describe('answerRunRequestInput', () => {
  it('takes a decision, with trimmed answers for a question', () => {
    expect(answerRunRequestInput.parse({ decision: 'deny' })).toEqual({ decision: 'deny' });
    expect(answerRunRequestInput.parse({ decision: 'allow', answers: [' Green '] })).toEqual({
      decision: 'allow',
      answers: ['Green'],
    });
  });

  it('refuses another decision, an empty answer and a long one', () => {
    expect(answerRunRequestInput.safeParse({ decision: 'maybe' }).success).toBe(false);
    expect(answerRunRequestInput.safeParse({ decision: 'allow', answers: [' '] }).success).toBe(
      false,
    );
    const long = 'a'.repeat(RUN_REQUEST_ANSWER_MAX + 1);
    expect(answerRunRequestInput.safeParse({ decision: 'allow', answers: [long] }).success).toBe(
      false,
    );
  });
});
