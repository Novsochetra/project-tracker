export const RUN_REQUEST_KINDS = ['permission', 'question', 'plan'] as const;
export type RunRequestKind = (typeof RUN_REQUEST_KINDS)[number];

export const RUN_REQUEST_STATUSES = ['open', 'answered', 'expired', 'cancelled'] as const;
export type RunRequestStatus = (typeof RUN_REQUEST_STATUSES)[number];

export const RUN_REQUEST_DECISIONS = ['allow', 'deny'] as const;
export type RunRequestDecision = (typeof RUN_REQUEST_DECISIONS)[number];

// Long enough to notice the phone and answer, short enough that a run never hangs on nobody.
export const RUN_REQUEST_DEADLINE_MS = 30 * 60_000;
// One wait of the helper's ends after this and it asks again, well under any proxy's idle limit.
export const RUN_REQUEST_WAIT_MS = 25_000;

export const RUN_REQUEST_LABEL_MAX = 300;
// A permission shows what will run, every line of a command and an address with its query, since
// the person decides on it; generous, so a cut is rare, and then said (labelCut).
export const RUN_PERMISSION_LABEL_MAX = 4000;
export const RUN_QUESTION_MAX = 500;
export const RUN_QUESTION_HEADER_MAX = 60;
export const RUN_QUESTION_OPTION_MAX = 200;
export const RUN_QUESTION_OPTION_DESCRIPTION_MAX = 300;
// Claude Code's AskUserQuestion asks at most 4 questions with at most 4 choices each.
export const RUN_QUESTIONS_MAX = 4;
export const RUN_QUESTION_OPTIONS_MAX = 4;
export const RUN_REQUEST_ANSWER_MAX = 1000;
// A plan is Claude's own Markdown, read whole before the person approves it.
export const RUN_PLAN_MAX = 20_000;

export const PLAN_MODES = ['edit', 'auto'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

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

// labelCut: the label was cut at its limit, so the phone says there is more than it shows.
export type RunRequestInput =
  | { kind: 'permission'; label: string; labelCut: boolean; questions: null }
  | { kind: 'question'; label: string; labelCut: boolean; questions: RunQuestion[] }
  | { kind: 'plan'; label: string; labelCut: boolean; questions: null };

export type RunRequest = RunRequestInput & {
  id: string;
  runId: string;
  status: RunRequestStatus;
  decision: RunRequestDecision | null;
  // One answer per question, in order: a choice's label, several joined with ", ", or the
  // person's own words. A plan's is the mode it was approved in, or the note to keep planning.
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
