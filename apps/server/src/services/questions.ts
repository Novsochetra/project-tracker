import { randomUUID } from 'node:crypto';
import {
  requestExpiresAt,
  type Actor,
  type askQuestionInput,
  type TicketQuestion,
} from '@tracker/shared';
import type { z } from 'zod';
import type { UserScope } from '../auth/scope';
import type { QuestionRow } from '../db/questionTables';
import { notFound } from '../errors';
import {
  findQuestionRow,
  insertQuestion,
  listTicketQuestionRows,
  runningRunOfTicket,
} from '../repositories/questions';
import { inTransaction, type ServiceContext, type UserContext } from './context';
import { requireTicket } from './lookups';
import { notifyQuestion, toQuestion } from './questionMappers';
import { settleQuestions } from './questionSweep';
import { eventEntry, writeTicket } from './ticketWrites';

type AskValues = z.output<typeof askQuestionInput>;

const askedEvent = (question: string): string => `asked: ${question}`;

// 404 rather than 403 for another user's question, like runs.
export async function requireQuestion(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<QuestionRow> {
  const row = await findQuestionRow(ctx.db, scope, id);
  if (!row) throw notFound('That question was not found.');
  return row;
}

export async function askQuestion(
  ctx: UserContext,
  actor: Actor,
  key: string,
  input: AskValues,
): Promise<TicketQuestion> {
  await settleQuestions(ctx);
  const { ref, row } = await inTransaction(ctx, async (trx) => {
    const ref = await requireTicket(trx, ctx.scope, key);
    const entries = [eventEntry(askedEvent(input.question))];
    const written = await writeTicket(trx, ctx.now, { ticket: ref.ticket, actor, entries });
    const createdAt = written.activities[0]?.createdAt ?? ctx.now();
    const row: QuestionRow = {
      id: randomUUID(),
      userId: ctx.scope,
      ticketId: ref.ticket.id,
      runId: (await runningRunOfTicket(trx, ctx.scope, ref.ticket.id))?.id ?? null,
      text: input.question,
      choices: JSON.stringify(input.choices),
      status: 'open',
      answer: null,
      createdAt,
      expiresAt: requestExpiresAt(createdAt),
      endedAt: null,
    };
    await insertQuestion(trx, row);
    return { ref, row };
  });
  notifyQuestion(ctx, ctx.scope, ref.project.id, ref.ticket.id);
  return toQuestion(row);
}

// Ended ones too, so the phone can show what was answered or that nobody answered.
export async function listQuestions(ctx: UserContext, key: string): Promise<TicketQuestion[]> {
  await settleQuestions(ctx);
  const { ticket } = await requireTicket(ctx.db, ctx.scope, key);
  return (await listTicketQuestionRows(ctx.db, ctx.scope, ticket.id)).map(toQuestion);
}
