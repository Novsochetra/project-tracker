import { RUN_REQUEST_DEADLINE_MS, type RunQuestion, type RunRequest } from '@tracker/shared';

export const makeRequest = (overrides: Partial<RunRequest> = {}): RunRequest =>
  ({
    id: 'q-1',
    runId: 'r-1',
    kind: 'permission',
    label: 'Run npm test',
    questions: null,
    status: 'open',
    decision: null,
    answers: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + RUN_REQUEST_DEADLINE_MS,
    endedAt: null,
    ...overrides,
  }) as RunRequest;

export const makeQuestion = (overrides: Partial<RunQuestion> = {}): RunQuestion => ({
  question: 'Which name should the queue get?',
  header: 'Name',
  options: [
    { label: 'syncQueue', description: 'Matches the other stores.' },
    { label: 'captureQueue', description: '' },
  ],
  multiSelect: false,
  ...overrides,
});

export const makeQuestionRequest = (
  questions: RunQuestion[] = [makeQuestion()],
  overrides: Partial<RunRequest> = {},
): RunRequest =>
  makeRequest({
    kind: 'question',
    label: `Ask: ${questions[0]?.question ?? ''}`,
    questions,
    ...overrides,
  } as Partial<RunRequest>);
