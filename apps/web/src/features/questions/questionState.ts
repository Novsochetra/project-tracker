import type { TicketQuestion } from '@tracker/shared';

export type QuestionState = 'open' | 'answered' | 'ended';

type Timed = Pick<TicketQuestion, 'status' | 'expiresAt'>;

// The tracker ends a question past its deadline only when it is next read, so the phone's own
// clock takes the buttons away first.
export function questionState(question: Timed, now: number): QuestionState {
  if (question.status === 'answered' || question.status === 'skipped') return 'answered';

  return question.status === 'open' && now < question.expiresAt ? 'open' : 'ended';
}

export const isOpen = (question: Timed, now: number): boolean =>
  questionState(question, now) === 'open';
