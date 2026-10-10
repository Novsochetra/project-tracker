export const RUN_REQUEST_KINDS = ['permission', 'question'] as const;
export type RunRequestKind = (typeof RUN_REQUEST_KINDS)[number];

export const RUN_REQUEST_STATUSES = ['open', 'answered', 'expired', 'cancelled'] as const;
export type RunRequestStatus = (typeof RUN_REQUEST_STATUSES)[number];

export const RUN_REQUEST_DECISIONS = ['allow', 'deny'] as const;
export type RunRequestDecision = (typeof RUN_REQUEST_DECISIONS)[number];

// Long enough to notice the phone and answer, short enough that a run never hangs on nobody.
export const RUN_REQUEST_DEADLINE_MS = 30 * 60_000;
// One wait of the helper's ends after this and it asks again, well under any proxy's idle limit.
export const RUN_REQUEST_WAIT_MS = 25_000;

// Room for a command's first line or a path; never a file's contents.
export const RUN_REQUEST_LABEL_MAX = 300;
export const RUN_QUESTION_MAX = 500;
export const RUN_QUESTION_HEADER_MAX = 60;
export const RUN_QUESTION_OPTION_MAX = 200;
export const RUN_QUESTION_OPTION_DESCRIPTION_MAX = 300;
// Claude Code's AskUserQuestion asks at most 4 questions with at most 4 choices each.
export const RUN_QUESTIONS_MAX = 4;
export const RUN_QUESTION_OPTIONS_MAX = 4;
export const RUN_REQUEST_ANSWER_MAX = 1000;

export interface RunQuestionOption {
  label: string;
  description: string;
}

export interface RunQuestion {
  question: string;
  header: string;
  options: RunQuestionOption[];
  multiSelect: boolean;
}

export type RunRequestInput =
  | { kind: 'permission'; label: string; questions: null }
  | { kind: 'question'; label: string; questions: RunQuestion[] };

export type RunRequest = RunRequestInput & {
  id: string;
  runId: string;
  status: RunRequestStatus;
  decision: RunRequestDecision | null;
  // One answer per question, in order: a choice's label, several joined with ", ", or the
  // person's own words.
  answers: string[] | null;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
};

export interface RunRequestEvent {
  type: 'run-request';
  runId: string;
  requestId: string;
  projectId: string;
  ticketId: string | null;
  chatId: string | null;
  status: RunRequestStatus;
}
