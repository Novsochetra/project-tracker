import type { TicketQuestion } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { QuestionRow } from '../db/questionTables';
import type { ServiceContext } from './context';

// The tracker wrote this text itself, so a value that doesn't parse is only ever a bug: shown as
// no choices rather than failing the read.
function choicesOf(text: string): string[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export const toQuestion = (row: QuestionRow): TicketQuestion => ({
  id: row.id,
  ticketId: row.ticketId,
  runId: row.runId,
  text: row.text,
  choices: choicesOf(row.choices),
  status: row.status,
  answer: row.answer,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  endedAt: row.endedAt,
});

// A question changes its ticket's screen, so it goes out as the ticket's change.
export function notifyQuestion(
  ctx: ServiceContext,
  userId: UserScope,
  projectId: string,
  ticketId: string,
): void {
  ctx.events.publish({ userId, event: { type: 'changed', projectId, ticketId } });
}
