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

export const listStoppedChatRunRows = (db: Db, userId: UserScope, chatId: string) =>
  runsOf(db, userId)
    .where('runs.chatId', '=', chatId)
    .where('runs.status', 'in', ['failed', 'cancelled'])
    .where('runs.stepCount', '>', 0)
    .orderBy('runs.createdAt')
    .orderBy('runs.id')
    .execute();

// The helper's lane, not the run's kind: an Edit question changes the folder, so it waits in the
// ticket lane, as laneOf in shared says. Older asks have no mode and stay in the ask lane.
const inLane = (lane: RunKind) => (eb: ExpressionBuilder<Database, 'runs'>) =>
  lane === 'ticket'
    ? eb.or([eb('runs.kind', '=', 'ticket'), eb('runs.askMode', '=', 'edit')])
    : eb.and([
        eb('runs.kind', '=', 'ask'),
        eb.or([eb('runs.askMode', 'is', null), eb('runs.askMode', '!=', 'edit')]),
      ]);

// A take that names no lane comes from a helper built before asks. It throws on a question, which
// has no ticket, so it gets ticket runs only and a question waits for a helper that names its lane.
const takenBy = (lane: RunKind | undefined) =>
  lane === undefined
    ? (eb: ExpressionBuilder<Database, 'runs'>) => eb('runs.kind', '=', 'ticket')
    : inLane(lane);

export interface QueueSlot {
  runnerId: string;
  lane: RunKind | undefined;
  projectIds: readonly string[];
}

export const nextQueuedRun = (
  db: Db,
  userId: UserScope,
  { runnerId, lane, projectIds }: QueueSlot,
) =>
  projectIds.length === 0
    ? Promise.resolve(undefined)
    : runsOf(db, userId)
        .where('runs.runnerId', '=', runnerId)
        .where(takenBy(lane))
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
  of: { runnerId: string; statuses: readonly RunStatus[]; lane?: RunKind },
  ended: { error: string; endedAt: number },
) =>
  db
    .updateTable('runs')
    .set({ status: 'failed', ...ended })
    .where(ownedBy(userId))
    .where('runnerId', '=', of.runnerId)
    .where('status', 'in', of.statuses)
    .$if(of.lane !== undefined, (query) => query.where(inLane(of.lane as RunKind)))
    .returningAll()
    .execute();

export const assignOwnerlessRuns = (db: Db, userId: string) =>
  db.updateTable('runs').set({ userId }).where('userId', 'is', null).execute();
