import { RUN_REQUEST_ANSWER_MAX } from './runRequest';

export const QUESTION_STATUSES = ['open', 'answered', 'skipped', 'expired', 'cancelled'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_TEXT_MAX = 1000;
export const QUESTION_CHOICE_MAX = 200;
export const QUESTION_CHOICES_MAX = 6;
// The phone's answer card is the run requests' one, which keeps own words within this.
export const QUESTION_ANSWER_MAX = RUN_REQUEST_ANSWER_MAX;

// runId is the ticket's running run when it was asked, so the question ends with that run.
export interface TicketQuestion {
  id: string;
  ticketId: string;
  runId: string | null;
  text: string;
  choices: string[];
  status: QuestionStatus;
  answer: string | null;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
}
