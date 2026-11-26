export const QUESTION_STATUSES = ['open', 'answered', 'skipped', 'expired', 'cancelled'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_TEXT_MAX = 1000;
export const QUESTION_CHOICE_MAX = 200;
export const QUESTION_CHOICES_MAX = 6;
export const QUESTION_ANSWER_MAX = 1000;

// Long enough to notice the phone and answer, short enough that an agent never waits on nobody.
export const QUESTION_DEADLINE_MS = 30 * 60_000;
// One wait of an agent's ends after this and it asks again, well under any proxy's idle limit.
export const QUESTION_WAIT_MS = 25_000;

export interface TicketQuestion {
  id: string;
  ticketId: string;
  text: string;
  choices: string[];
  status: QuestionStatus;
  answer: string | null;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
}
