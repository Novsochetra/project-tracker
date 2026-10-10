import type { RunRequest } from '@tracker/shared';

export const permissionRequest = (changes: Partial<RunRequest> = {}): RunRequest =>
  ({
    id: 'q-1',
    runId: 'r-1',
    kind: 'permission',
    label: 'Run npm test',
    questions: null,
    status: 'open',
    decision: null,
    answers: null,
    createdAt: 0,
    expiresAt: 1_800_000,
    endedAt: null,
    ...changes,
  }) as RunRequest;

export const QUESTION_INPUT = {
  questions: [
    {
      question: 'Which color should the button be?',
      header: 'Color',
      options: [
        { label: 'Red', description: 'Red button.' },
        { label: 'Green', description: 'Green button.' },
      ],
      multiSelect: false,
    },
    { question: 'Which size?', header: 'Size', options: [], multiSelect: false },
  ],
};

export const questionRequest = (changes: Partial<RunRequest> = {}): RunRequest =>
  permissionRequest({
    kind: 'question',
    label: 'Which color should the button be?',
    questions: QUESTION_INPUT.questions,
    ...changes,
  } as Partial<RunRequest>);
