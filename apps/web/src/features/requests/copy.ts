export const PERMISSION_HEAD = 'Claude asks for permission';
export const QUESTION_HEAD = 'Claude asks you';
export const ALLOW_LABEL = 'Allow';
export const DENY_LABEL = 'Deny';
export const SEND_LABEL = 'Send answer';
export const SKIP_LABEL = 'Skip';
export const OTHER_PLACEHOLDER = 'Something else…';
export const LABEL_CUT_TEXT = 'It goes on past what is shown. Deny it if you are not sure.';
export const WAITING_TEXT = 'Claude is waiting for your answer.';
export const WAITING_ROW_TEXT = 'Waiting for you';

export const OUTCOME_TEXT = {
  allowed: 'Allowed',
  denied: 'Denied',
  skipped: 'Skipped',
  none: 'No answer',
} as const;

export const requestName = (subject: string): string => `Claude asks: ${subject}`;

export const otherLabel = (question: string): string => `Your own answer to: ${question}`;

export const choicesLabel = (question: string): string => `Choices for: ${question}`;
