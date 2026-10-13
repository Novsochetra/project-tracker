import type { QuestionStatus } from '@tracker/shared';

export interface QuestionRow {
  id: string;
  userId: string | null;
  ticketId: string;
  runId: string | null;
  text: string;
  // JSON as text, like runners.project_ids: no JSON columns (§2).
  choices: string;
  status: QuestionStatus;
  answer: string | null;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
}

export interface QuestionTables {
  questions: QuestionRow;
}
