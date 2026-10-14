import {
  ACTIVE_RUN_STATUSES,
  type AskMode,
  type EndedRunStatus,
  type RunLane,
  type RunStatus,
  type RunUsage,
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
export const ownedBy = (userId: UserScope) => (eb: ExpressionBuilder<Database, 'runs'>) =>
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

// Both run on every look at a chat, so the plan test (chatRunReads) checks they use
// runs_chat_created_idx.
export const latestChatRunQuery = (db: Db, userId: UserScope, chatId: string) =>
  runsOf(db, userId)
    .where('runs.chatId', '=', chatId)
    .orderBy('runs.createdAt', 'desc')
    .orderBy('runs.id', 'desc');

export const stoppedChatRunsQuery = (db: Db, userId: UserScope, chatId: string) =>
  runsOf(db, userId)
    .where('runs.chatId', '=', chatId)
    .where('runs.status', 'in', ['failed', 'cancelled'])
    .where('runs.stepCount', '>', 0)
    .orderBy('runs.createdAt')
    .orderBy('runs.id');

export const latestChatRunRow = (db: Db, userId: UserScope, chatId: string) =>
  latestChatRunQuery(db, userId, chatId).executeTakeFirst();

export const listStoppedChatRunRows = (db: Db, userId: UserScope, chatId: string) =>
  stoppedChatRunsQuery(db, userId, chatId).execute();

const FOLDER_MODES: AskMode[] = ['edit', 'auto'];

// The helper's lane, not the run's kind: an Edit or Auto question changes the folder, so it waits in the
// ticket lane, as laneOf in shared says. Older asks have no mode and stay in the ask lane.
const inLane = (lane: RunLane) => (eb: ExpressionBuilder<Database, 'runs'>) =>
  lane === 'ticket'
    ? eb.or([eb('runs.kind', 'in', ['ticket', 'batch']), eb('runs.askMode', 'in', FOLDER_MODES)])
    : eb.and([
        eb('runs.kind', '=', 'ask'),
        eb.or([eb('runs.askMode', 'is', null), eb('runs.askMode', 'not in', FOLDER_MODES)]),
      ]);

// A take that names no lane comes from a helper built before asks. It throws on a question, which
// has no ticket, so it gets ticket runs only and a question waits for a newer helper. One built
// before batches refuses them, so it never gets one either (runQueue ends them).
const takenBy = ({ lane, batches }: Pick<QueueSlot, 'lane' | 'batches'>) =>
  lane === undefined
    ? (eb: ExpressionBuilder<Database, 'runs'>) => eb('runs.kind', '=', 'ticket')
    : (eb: ExpressionBuilder<Database, 'runs'>) =>
        batches ? inLane(lane)(eb) : eb.and([inLane(lane)(eb), eb('runs.kind', '!=', 'batch')]);

// The project's setting caps its runs that are running; asks count too, since each is a process on
// the machine. A batch counts once: its tickets' runs are its sub agents, which it caps itself.
// Also in markRunStarted, which a take runs while it holds the project (holdProjectRuns), so two
// takes that race can't both pass.
const underLimit = (eb: ExpressionBuilder<Database, 'runs'>) =>
  eb(
    eb
      .selectFrom('runs as active')
      .select((sub) => sub.fn.countAll<number>().as('running'))
      .whereRef('active.projectId', '=', 'runs.projectId')
      .where('active.status', '=', 'running')
      .where('active.batchId', 'is', null),
    '<',
    eb
      .selectFrom('projects as limited')
      .select('limited.maxParallelRuns')
      .whereRef('limited.id', '=', 'runs.projectId'),
  );

export interface QueueSlot {
  runnerId: string;
  lane: RunLane | undefined;
  batches: boolean;
  projectIds: readonly string[];
}

export const nextQueuedRun = (
  db: Db,
  userId: UserScope,
  { runnerId, lane, batches, projectIds }: QueueSlot,
) =>
  projectIds.length === 0
    ? Promise.resolve(undefined)
    : runsOf(db, userId)
        .where('runs.runnerId', '=', runnerId)
        .where(takenBy({ lane, batches }))
        .where('runs.status', '=', 'queued')
        .where('runs.batchId', 'is', null)
        .where(underLimit)
        .where('runs.projectId', 'in', projectIds)
        .orderBy('runs.createdAt')
        .orderBy('runs.id')
        .executeTakeFirst();

export async function activeRunTicketIds(db: Db, ticketIds: readonly string[]): Promise<string[]> {
  if (ticketIds.length === 0) return [];
  const rows = await db
    .selectFrom('runs')
    .select('ticketId')
    .where('ticketId', 'in', ticketIds)
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .execute();
  return rows.flatMap((row) => (row.ticketId ? [row.ticketId] : []));
}

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
    .where(underLimit)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export async function markRunEnded(
  db: Db,
  userId: UserScope,
  id: string,
  changes: Pick<RunRow, 'error' | 'endedAt'> & Partial<RunUsage> & { status: EndedRunStatus },
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
  of: { runnerId: string; statuses: readonly RunStatus[]; lane?: RunLane },
  ended: { error: string; endedAt: number },
) =>
  db
    .updateTable('runs')
    .set({ status: 'failed', ...ended })
    .where(ownedBy(userId))
    .where('runnerId', '=', of.runnerId)
    .where('status', 'in', of.statuses)
    // A batch's ticket runs end with their batch, never on their own (endOrphanBatchTickets).
    .where('batchId', 'is', null)
    .$if(of.lane !== undefined, (query) => query.where(inLane(of.lane as RunLane)))
    .returningAll()
    .execute();

export const assignOwnerlessRuns = (db: Db, userId: string) =>
  db.updateTable('runs').set({ userId }).where('userId', 'is', null).execute();

export interface ActivityRunRow {
  runId: string;
  batchId: string | null;
  status: RunStatus;
  createdAt: number;
  startedAt: number | null;
  projectKey: string;
  projectName: string;
  projectHideName: number;
  ticketNum: number;
  ticketTitle: string;
}

// Only ticket runs: an ask has no ticket to show or open. The project must be the person's too,
// so a run can never show a project they lost.
export const listActivityRunRows = (
  db: Db,
  userId: UserScope,
  failedSince: number,
): Promise<ActivityRunRow[]> =>
  db
    .selectFrom('runs')
    .innerJoin('tickets', 'tickets.id', 'runs.ticketId')
    .innerJoin('projects', 'projects.id', 'runs.projectId')
    .select([
      'runs.id as runId',
      'runs.batchId',
      'runs.status',
      'runs.createdAt',
      'runs.startedAt',
      'projects.key as projectKey',
      'projects.name as projectName',
      'projects.hideName as projectHideName',
      'tickets.num as ticketNum',
      'tickets.title as ticketTitle',
    ])
    .where(ownedBy(userId))
    .where((eb) =>
      userId === null ? eb('projects.ownerId', 'is', null) : eb('projects.ownerId', '=', userId),
    )
    .where((eb) =>
      eb.or([
        eb('runs.status', 'in', ACTIVE_RUN_STATUSES),
        eb.and([eb('runs.status', '=', 'failed'), eb('runs.endedAt', '>=', failedSince)]),
      ]),
    )
    .orderBy('runs.createdAt', 'desc')
    .orderBy('runs.id', 'desc')
    .execute();

// Batches the person may still need to see: active ones, and ones that ended since `since`, so
// tickets they left unfinished stay in view.
export const listActivityBatchRows = (db: Db, userId: UserScope, since: number) =>
  db
    .selectFrom('runs')
    .innerJoin('projects', 'projects.id', 'runs.projectId')
    .select([
      'runs.id as runId',
      'runs.status',
      'runs.createdAt',
      'runs.startedAt',
      'projects.key as projectKey',
      'projects.name as projectName',
      'projects.hideName as projectHideName',
    ])
    .where(ownedBy(userId))
    .where((eb) =>
      userId === null ? eb('projects.ownerId', 'is', null) : eb('projects.ownerId', '=', userId),
    )
    .where('runs.kind', '=', 'batch')
    .where((eb) =>
      eb.or([eb('runs.status', 'in', ACTIVE_RUN_STATUSES), eb('runs.endedAt', '>=', since)]),
    )
    .orderBy('runs.createdAt', 'desc')
    .orderBy('runs.id', 'desc')
    .execute();
