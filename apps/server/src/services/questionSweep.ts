import type { QuestionRow } from '../db/questionTables';
import { expireOverdueQuestions, projectsOfTickets } from '../repositories/questions';
import type { ServiceContext } from './context';
import { notifyQuestion } from './questionMappers';

async function notifyEnded(ctx: ServiceContext, rows: readonly QuestionRow[]): Promise<void> {
  const tickets = await projectsOfTickets(ctx.db, [...new Set(rows.map((row) => row.ticketId))]);
  const projectOf = new Map(tickets.map((ticket) => [ticket.id, ticket.projectId]));
  const told = new Set<string>();
  for (const row of rows) {
    const projectId = projectOf.get(row.ticketId);
    if (!projectId || told.has(row.ticketId)) continue;
    told.add(row.ticketId);
    notifyQuestion(ctx, row.userId, projectId, row.ticketId);
  }
}

// Questions end when someone next looks: one past its deadline expired.
export async function settleQuestions(ctx: ServiceContext): Promise<void> {
  await notifyEnded(ctx, await expireOverdueQuestions(ctx.db, ctx.now()));
}
