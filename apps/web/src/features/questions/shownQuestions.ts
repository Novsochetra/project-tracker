import type { RunRequest, TicketQuestion } from '@tracker/shared';
import { shownRequests } from '../requests/requestState';
import { asRunRequest } from './questionRequest';

// The card that shows an answer stays a while, so a tap shows what it did; the activity keeps it.
export const SETTLED_SHOWN_MS = 60 * 60_000;

const recent = (question: TicketQuestion, now: number): boolean =>
  (question.endedAt ?? question.expiresAt) > now - SETTLED_SHOWN_MS;

export const shownQuestions = (questions: readonly TicketQuestion[], now: number): RunRequest[] =>
  shownRequests(questions.filter((question) => recent(question, now)).map(asRunRequest), now);
