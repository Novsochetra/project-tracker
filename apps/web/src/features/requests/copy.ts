export const PERMISSION_HEAD = 'Claude asks for permission';
export const QUESTION_HEAD = 'Claude asks you';
export const PLAN_HEAD = 'Claude has a plan';
export const ALLOW_LABEL = 'Allow';
export const DENY_LABEL = 'Deny';
export const SEND_ANSWER_LABEL = 'Send answer';
export const SKIP_LABEL = 'Skip';
export const APPROVE_EDIT_LABEL = 'Approve and edit';
export const APPROVE_AUTO_LABEL = 'Approve and auto';
export const KEEP_PLANNING_LABEL = 'Keep planning';
export const PLAN_NOTE_PLACEHOLDER = 'What to change (optional)';
export const PLAN_NOTE_LABEL = 'Note for Claude when you keep planning';
export const PLAN_CUT_TEXT = 'The plan goes on past what is shown.';
export const OTHER_PLACEHOLDER = 'Something else…';
export const LABEL_CUT_TEXT = 'It goes on past what is shown. Deny it if you are not sure.';
export const HIDDEN_CHARS_TEXT =
  'It holds characters that hide or reorder text, shown marked. Deny it if you are not sure.';
export const LOOKALIKE_TEXT =
  'It holds letters from another script that look like others, shown marked. Deny it if you are not sure.';
export const WAITING_TEXT = 'Claude is waiting for your answer.';
export const WAITING_ROW_TEXT = 'Waiting for you';
// A ticket's row could be read as waiting for a review, so screen readers hear who waits.
export const WAITING_ROW_NAME = 'Claude is waiting for you';

export const OUTCOME_TEXT = {
  allowed: 'Allowed',
  denied: 'Denied',
  skipped: 'Skipped',
  none: 'No answer',
  approved: 'Approved',
  planning: 'Keep planning',
} as const;

export const PLAN_MODE_NAMES = { edit: 'Edit', auto: 'Auto' } as const;

export const approvedText = (mode: keyof typeof PLAN_MODE_NAMES): string =>
  `Approved: carried out in ${PLAN_MODE_NAMES[mode]}`;

export const requestName = (subject: string): string => `Claude asks: ${subject}`;

export const otherLabel = (question: string): string => `Your own answer to: ${question}`;

export const choicesLabel = (question: string): string => `Choices for: ${question}`;
