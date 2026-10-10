import { ACTIVE_RUN_STATUSES, type EndedRunStatus } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRow } from '../db/runTables';
import type { Db } from '../db/schema';

export interface RunWithKey extends RunRow {
  projectKey: string;
  ticketNum: number;
}

// '=' never matches a null user, so the open tracker's rows need 'is'.
const runsOf = (db: Db, userId: UserScope) => {
  const query = db
    .selectFrom('runs')
    .innerJoin('tickets', 'tickets.id', 'runs.ticketId')
    .innerJoin('projects', 'projects.id', 'runs.projectId')
    .selectAll('runs')
    .select(['projects.key as projectKey', 'tickets.num as ticketNum']);
  return userId === null
    ? query.where('runs.userId', 'is', null)
    : query.where('runs.userId', '=', userId);
};

export const findRunInScope = (db: Db, userId: UserScope, id: string) =>
  runsOf(db, userId).where('runs.id', '=', id).executeTakeFirst();

export const listTicketRunRows = (db: Db, userId: UserScope, ticketId: string, limit: number) =>
  runsOf(db, userId)
    .where('runs.ticketId', '=', ticketId)
    .orderBy('runs.createdAt', 'desc')
    .orderBy('runs.id', 'desc')
    .limit(limit)
    .execute();

export const nextQueuedRun = (
  db: Db,
  userId: UserScope,
  runnerId: string,
  projectIds: readonly string[],
) =>
  projectIds.length === 0
    ? Promise.resolve(undefined)
    : runsOf(db, userId)
        .where('runs.runnerId', '=', runnerId)
        .where('runs.status', '=', 'queued')
        .where('runs.projectId', 'in', projectIds)
        .orderBy('runs.createdAt')
        .orderBy('runs.id')
        .executeTakeFirst();

export async function insertRun(db: Db, row: RunRow): Promise<void> {
  await db.insertInto('runs').values(row).execute();
}

// Only a queued run starts, so two takes that race can't both get it.
export async function markRunStarted(db: Db, id: string, startedAt: number): Promise<boolean> {
  const result = await db
    .updateTable('runs')
    .set({ status: 'running', startedAt })
    .where('id', '=', id)
    .where('status', '=', 'queued')
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export async function markRunEnded(
  db: Db,
  id: string,
  changes: { status: EndedRunStatus; error: string | null; endedAt: number },
): Promise<boolean> {
  const result = await db
    .updateTable('runs')
    .set(changes)
    .where('id', '=', id)
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export const failQueuedRunsBefore = (db: Db, createdBefore: number, error: string, now: number) =>
  db
    .updateTable('runs')
    .set({ status: 'failed', error, endedAt: now })
    .where('status', '=', 'queued')
    .where('createdAt', '<=', createdBefore)
    .returningAll()
    .execute();

export const failActiveRunsOf = (db: Db, runnerId: string, error: string, now: number) =>
  db
    .updateTable('runs')
    .set({ status: 'failed', error, endedAt: now })
    .where('runnerId', '=', runnerId)
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .returningAll()
    .execute();
