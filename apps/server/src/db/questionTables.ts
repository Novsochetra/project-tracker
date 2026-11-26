import type { QuestionStatus } from '@tracker/shared';

export interface QuestionRow {
  id: string;
  userId: string | null;
  ticketId: string;
  text: string;
  // JSON as text: no JSON columns (§2).
  choices: string;
  status: QuestionStatus;
  answer: string | null;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
  // The API token that asked; only it can cancel the question (null: no token asked).
  askedByTokenId: string | null;
}

export interface QuestionTables {
  questions: QuestionRow;
}
