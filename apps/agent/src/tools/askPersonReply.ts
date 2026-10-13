import { RUN_REQUEST_DEADLINE_MS, type TicketQuestion } from '@tracker/shared';
import type { PollEnd } from './pollUntilEnded';

export const QUESTION_LIMIT_MS = RUN_REQUEST_DEADLINE_MS;

export const NO_ANSWER =
  'No answer yet: go on with your best judgment and note the assumption in a comment.';
export const SKIPPED =
  'The person chose not to answer: go on with your best judgment and note the assumption in a comment.';

export const answeredText = (answer: string): string => `The person answered: ${answer}`;

// Anything but an answer lets Claude go on, so an unanswered question never fails the run.
export function replyText(end: PollEnd<TicketQuestion>): string {
  if (end.kind !== 'ended') return NO_ANSWER;
  const { status, answer } = end.value;
  if (status === 'answered' && answer !== null) return answeredText(answer);
  return status === 'skipped' ? SKIPPED : NO_ANSWER;
}
