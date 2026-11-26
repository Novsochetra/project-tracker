import type { TicketQuestion } from '@tracker/shared';
import { isOpen } from './questionState';

// The card that shows an answer stays a while, so a tap shows what it did; the activity keeps it.
export const SETTLED_SHOWN_MS = 60 * 60_000;

const settledAt = (question: TicketQuestion): number => question.endedAt ?? question.expiresAt;

function lastSettled(
  questions: readonly TicketQuestion[],
  now: number,
): TicketQuestion | undefined {
  let last: TicketQuestion | undefined;
  for (const question of questions) {
    if (isOpen(question, now)) continue;

    if (!last || settledAt(question) >= settledAt(last)) last = question;
  }

  return last;
}

// Every open question, and the one settled last, so a tap shows what it did without a pile of old
// answers growing on the ticket, whose activity already keeps each one.
export function shownQuestions(
  questions: readonly TicketQuestion[],
  now: number,
): TicketQuestion[] {
  const recent = questions.filter((question) => settledAt(question) > now - SETTLED_SHOWN_MS);
  const last = lastSettled(recent, now);

  return recent.filter((question) => question === last || isOpen(question, now));
}
