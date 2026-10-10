import {
  ACTIVE_RUN_STATUSES,
  type EndedRunStatus,
  type RunKind,
  type RunStatus,
} from '@tracker/shared';
import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { RunRow } from '../db/runTables';
import type { Database, Db } from '../db/schema';

export interface RunWithKey extends RunRow {
  projectKey: string;
  ticketNum: number | null;
}

// '=' never matches a null user, so the open tracker's rows need 'is'.
const ownedBy = (userId: UserScope) => (eb: ExpressionBuilder<Database, 'runs'>) =>
  userId === null ? eb('runs.userId', 'is', null) : eb('runs.userId', '=', userId);

const runsOf = (db: Db, userId: UserScope) =>
  db
    .selectFrom('runs')
    .leftJoin('tickets', 'tickets.id', 'runs.ticketId')
    .innerJoin('projects', 'projects.id', 'runs.projectId')
    .selectAll('runs')
    .select(['projects.key as projectKey', 'tickets.num as ticketNum'])
    .where(ownedBy(userId));

export const findRunInScope = (db: Db, userId: UserScope, id: string) =>
  runsOf(db, userId).where('runs.id', '=', id).executeTakeFirst();

export const listTicketRunRows = (db: Db, userId: UserScope, ticketId: string, limit: number) =>
  runsOf(db, userId)
    .where('runs.ticketId', '=', ticketId)
    .orderBy('runs.createdAt', 'desc')
    .orderBy('runs.id', 'desc')
    .limit(limit)
    .execute();

export const latestChatRunRow = (db: Db, userId: UserScope, chatId: string) =>
  runsOf(db, userId)
    .where('runs.chatId', '=', chatId)
    .orderBy('runs.createdAt', 'desc')
    .orderBy('runs.id', 'desc')
    .executeTakeFirst();

export interface QueueSlot {
  runnerId: string;
  kind: RunKind;
  projectIds: readonly string[];
}

export const nextQueuedRun = (
  db: Db,
  userId: UserScope,
  { runnerId, kind, projectIds }: QueueSlot,
) =>
  projectIds.length === 0
    ? Promise.resolve(undefined)
    : runsOf(db, userId)
        .where('runs.runnerId', '=', runnerId)
        .where('runs.kind', '=', kind)
        .where('runs.status', '=', 'queued')
        .where('runs.projectId', 'in', projectIds)
        .orderBy('runs.createdAt')
        .orderBy('runs.id')
        .executeTakeFirst();

export async function insertRun(db: Db, row: RunRow): Promise<void> {
  await db.insertInto('runs').values(row).execute();
}

// Only a queued run starts, so two takes that race can't both get it.
export async function markRunStarted(
  db: Db,
  userId: UserScope,
  id: string,
  startedAt: number,
): Promise<boolean> {
  const result = await db
    .updateTable('runs')
    .set({ status: 'running', startedAt })
    .where(ownedBy(userId))
    .where('id', '=', id)
    .where('status', '=', 'queued')
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export async function markRunEnded(
  db: Db,
  userId: UserScope,
  id: string,
  changes: { status: EndedRunStatus; error: string | null; endedAt: number },
): Promise<boolean> {
  const result = await db
    .updateTable('runs')
    .set(changes)
    .where(ownedBy(userId))
    .where('id', '=', id)
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

// Silence counts from the later of the run's start and its helper's last check-in, so a run
// waits while its helper is busy with another.
export const failRunsOfSilentHelpers = (
  db: Db,
  status: RunStatus,
  silentSince: number,
  ended: { error: string; endedAt: number },
) =>
  db
    .updateTable('runs')
    .set({ status: 'failed', ...ended })
    .where('status', '=', status)
    .where('createdAt', '<=', silentSince)
    .where((eb) =>
      eb.or([
        eb('runnerId', 'is', null),
        eb(
          'runnerId',
          'in',
          eb
            .selectFrom('runners')
            .select('runners.id')
            .where('runners.lastSeenAt', '<=', silentSince),
        ),
      ]),
    )
    .returningAll()
    .execute();

export const failRunsOf = (
  db: Db,
  userId: UserScope,
  of: { runnerId: string; statuses: readonly RunStatus[]; kind?: RunKind },
  ended: { error: string; endedAt: number },
) =>
  db
    .updateTable('runs')
    .set({ status: 'failed', ...ended })
    .where(ownedBy(userId))
    .where('runnerId', '=', of.runnerId)
    .where('status', 'in', of.statuses)
    .$if(of.kind !== undefined, (query) => query.where('kind', '=', of.kind as RunKind))
    .returningAll()
    .execute();

export const assignOwnerlessRuns = (db: Db, userId: string) =>
  db.updateTable('runs').set({ userId }).where('userId', 'is', null).execute();
