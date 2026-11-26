export const QUESTION_HEAD = 'An agent asks you';
export const QUESTIONS_NAME = 'Questions from agents';
export const SEND_ANSWER_LABEL = 'Send answer';
export const SKIP_LABEL = 'Skip';
export const OTHER_PLACEHOLDER = 'Something else…';
export const SKIPPED_TEXT = 'Skipped';
export const NO_ANSWER_TEXT = 'No answer';
export const WAITING_ROW_TEXT = 'Waiting for you';
// A ticket's row could be read as waiting for a review, so screen readers hear who waits.
export const WAITING_ROW_NAME = 'An agent is waiting for you';

export const questionName = (subject: string): string => `An agent asks: ${subject}`;

export const otherLabel = (question: string): string => `Your own answer to: ${question}`;

export const choicesLabel = (question: string): string => `Choices for: ${question}`;
