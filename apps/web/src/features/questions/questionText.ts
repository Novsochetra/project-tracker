import type { TicketQuestion } from '@tracker/shared';
import { showHidden } from '../../lib/hiddenChars';
import { NO_ANSWER_TEXT, QUESTION_HEAD, SKIPPED_TEXT } from './copy';
import { questionState } from './questionState';

export type Outcome = 'answered' | 'skipped' | 'none';

// Marked, so a character that hides or reorders text can't make a name or summary read as another.
export const subjectOf = (question: Pick<TicketQuestion, 'text'>): string =>
  showHidden(question.text);

export function questionOutcome(question: TicketQuestion, now: number): Outcome {
  if (questionState(question, now) === 'ended') return 'none';

  return question.status === 'skipped' ? 'skipped' : 'answered';
}

export function outcomeLines(question: TicketQuestion, now: number): string[] {
  const outcome = questionOutcome(question, now);
  if (outcome === 'answered') return question.answer === null ? [] : [question.answer];

  return [outcome === 'skipped' ? SKIPPED_TEXT : NO_ANSWER_TEXT];
}

export const announcementOf = (question: TicketQuestion): string =>
  `${QUESTION_HEAD}: ${subjectOf(question)}`;
