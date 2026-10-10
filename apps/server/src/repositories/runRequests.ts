import { ACTIVE_RUN_STATUSES, type RunRequestDecision } from '@tracker/shared';
import type { RunRequestRow } from '../db/runTables';
import type { Db } from '../db/schema';

export async function insertRunRequest(db: Db, row: RunRequestRow): Promise<void> {
  await db.insertInto('runRequests').values(row).execute();
}

export const findRunRequestRow = (db: Db, id: string) =>
  db.selectFrom('runRequests').selectAll().where('id', '=', id).executeTakeFirst();

export const listRunRequestRows = (db: Db, runId: string) =>
  db
    .selectFrom('runRequests')
    .selectAll()
    .where('runId', '=', runId)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export interface Answered {
  decision: RunRequestDecision;
  answers: string | null;
  endedAt: number;
}

// Only an open request of a running run before its deadline takes an answer, so of two answers
// that race only one lands.
export async function markRequestAnswered(db: Db, id: string, answer: Answered) {
  const result = await db
    .updateTable('runRequests')
    .set({ ...answer, status: 'answered' })
    .where('id', '=', id)
    .where('status', '=', 'open')
    .where('expiresAt', '>', answer.endedAt)
    .where('runId', 'in', (eb) =>
      eb.selectFrom('runs').select('runs.id').where('runs.status', '=', 'running'),
    )
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export const cancelRequestsOfEndedRuns = (db: Db, endedAt: number) =>
  db
    .updateTable('runRequests')
    .set({ status: 'cancelled', endedAt })
    .where('status', '=', 'open')
    .where('runId', 'not in', (eb) =>
      eb.selectFrom('runs').select('runs.id').where('runs.status', 'in', ACTIVE_RUN_STATUSES),
    )
    .returningAll()
    .execute();

export const expireOverdueRequests = (db: Db, endedAt: number) =>
  db
    .updateTable('runRequests')
    .set({ status: 'expired', endedAt })
    .where('status', '=', 'open')
    .where('expiresAt', '<=', endedAt)
    .returningAll()
    .execute();

export const runsOfRequests = (db: Db, runIds: readonly string[]) =>
  runIds.length === 0
    ? Promise.resolve([])
    : db
        .selectFrom('runs')
        .select(['id', 'userId', 'projectId', 'ticketId', 'chatId'])
        .where('id', 'in', runIds)
        .execute();
