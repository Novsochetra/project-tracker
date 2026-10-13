import { ACTIVE_RUN_STATUSES } from '@tracker/shared';
import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { QuestionRow } from '../db/questionTables';
import type { Database, Db } from '../db/schema';

// '=' never matches a null user, so the open tracker's rows need 'is'.
const ownedBy = (userId: UserScope) => (eb: ExpressionBuilder<Database, 'questions'>) =>
  userId === null ? eb('questions.userId', 'is', null) : eb('questions.userId', '=', userId);

export async function insertQuestion(db: Db, row: QuestionRow): Promise<void> {
  await db.insertInto('questions').values(row).execute();
}

export const findQuestionRow = (db: Db, userId: UserScope, id: string) =>
  db
    .selectFrom('questions')
    .selectAll()
    .where('id', '=', id)
    .where(ownedBy(userId))
    .executeTakeFirst();

export const listTicketQuestionRows = (db: Db, userId: UserScope, ticketId: string) =>
  db
    .selectFrom('questions')
    .selectAll()
    .where('ticketId', '=', ticketId)
    .where(ownedBy(userId))
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export const runningRunOfTicket = (db: Db, userId: UserScope, ticketId: string) =>
  db
    .selectFrom('runs')
    .select('id')
    .where('ticketId', '=', ticketId)
    .where('status', '=', 'running')
    .where((eb) => (userId === null ? eb('userId', 'is', null) : eb('userId', '=', userId)))
    .executeTakeFirst();

export type QuestionEnd = Pick<QuestionRow, 'answer' | 'endedAt'> & {
  status: 'answered' | 'skipped';
};

// Only an open question before its deadline, whose run (if any) still runs, takes an answer, so
// of two answers that race only one lands.
export async function markQuestionEnded(db: Db, id: string, end: QuestionEnd): Promise<boolean> {
  const result = await db
    .updateTable('questions')
    .set(end)
    .where('id', '=', id)
    .where('status', '=', 'open')
    .where('expiresAt', '>', end.endedAt ?? 0)
    .where((eb) =>
      eb.or([
        eb('runId', 'is', null),
        eb('runId', 'in', eb.selectFrom('runs').select('runs.id').where('status', '=', 'running')),
      ]),
    )
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export async function markQuestionCancelled(db: Db, id: string, endedAt: number) {
  const result = await db
    .updateTable('questions')
    .set({ status: 'cancelled', endedAt })
    .where('id', '=', id)
    .where('status', '=', 'open')
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export const cancelQuestionsOfEndedRuns = (db: Db, endedAt: number) =>
  db
    .updateTable('questions')
    .set({ status: 'cancelled', endedAt })
    .where('status', '=', 'open')
    .where('runId', 'in', (eb) =>
      eb.selectFrom('runs').select('runs.id').where('runs.status', 'not in', ACTIVE_RUN_STATUSES),
    )
    .returningAll()
    .execute();

export const expireOverdueQuestions = (db: Db, endedAt: number) =>
  db
    .updateTable('questions')
    .set({ status: 'expired', endedAt })
    .where('status', '=', 'open')
    .where('expiresAt', '<=', endedAt)
    .returningAll()
    .execute();

export const projectsOfTickets = (db: Db, ticketIds: readonly string[]) =>
  ticketIds.length === 0
    ? Promise.resolve([])
    : db.selectFrom('tickets').select(['id', 'projectId']).where('id', 'in', ticketIds).execute();
