import {
  BATCH_TICKETS_MAX,
  buildBatchPrompt,
  formatTicketKey,
  MAX_PARALLEL_RUNS_MAX,
  sameTicketKeys,
  workableTickets,
  type RunAllInput,
  type RunAllPreview,
  type RunAllResult,
} from '@tracker/shared';
import { randomUUID } from 'node:crypto';
import type { UserScope } from '../auth/scope';
import { isUniqueViolation } from '../db/errors';
import type { RunRow } from '../db/runTables';
import type { Db, ProjectRow, TicketRow } from '../db/schema';
import { conflict } from '../errors';
import { activeRunTicketIds, insertRun } from '../repositories/runs';
import { listStatusRows } from '../repositories/statuses';
import { listTicketRows } from '../repositories/tickets';
import { inTransaction, type ServiceContext } from './context';
import { requireProject } from './lookups';
import { notifyRun } from './runMappers';
import { requireRunnerFor } from './runners';
import { queuedRunRow, type QueuedRun } from './runRows';
import { expireSilentRuns } from './runs';

const RACED = 'Some of these tickets just started. Try Run all again.';
const CHANGED = 'The To do list changed. Check the card again.';

interface RunAllPick {
  tickets: TicketRow[];
  skippedActive: number;
  skippedDevice: number;
  leftOver: number;
}

async function pickTodo(db: Db, project: ProjectRow): Promise<RunAllPick> {
  const statuses = await listStatusRows(db, project.id);
  const todoIds = new Set(
    statuses.filter(({ category }) => category === 'todo').map(({ id }) => id),
  );
  const todo = workableTickets(
    (await listTicketRows(db, project.id)).filter(({ statusId }) => todoIds.has(statusId)),
    statuses,
  );
  const active = new Set(
    await activeRunTicketIds(
      db,
      todo.map(({ id }) => id),
    ),
  );
  const free = todo.filter(({ id }) => !active.has(id));
  const workable = free.filter(({ needsDevice }) => !needsDevice);
  return {
    tickets: workable.slice(0, BATCH_TICKETS_MAX),
    skippedActive: todo.length - free.length,
    skippedDevice: free.length - workable.length,
    leftOver: Math.max(0, workable.length - BATCH_TICKETS_MAX),
  };
}

// Only a person's number sets the sub agents at once; without one Claude decides.
const maxParallelOf = (input: Pick<RunAllInput, 'maxParallel'>): number | null =>
  input.maxParallel === undefined
    ? null
    : Math.max(1, Math.min(MAX_PARALLEL_RUNS_MAX, input.maxParallel));

export async function previewRunAll(
  ctx: ServiceContext,
  scope: UserScope,
  projectKey: string,
): Promise<RunAllPreview> {
  await expireSilentRuns(ctx);
  const project = await requireProject(ctx.db, scope, projectKey);
  const pick = await pickTodo(ctx.db, project);
  return {
    tickets: pick.tickets.map((ticket) => ({
      ticketKey: formatTicketKey(project.key, ticket.num),
      ticketTitle: ticket.title,
    })),
    skippedActive: pick.skippedActive,
    skippedDevice: pick.skippedDevice,
    leftOver: pick.leftOver,
    maxParallel: null,
  };
}

function batchRows(
  queued: QueuedRun,
  project: ProjectRow,
  tickets: TicketRow[],
  limit: number | null,
) {
  const batchId = randomUUID();
  const prompt = buildBatchPrompt(
    project,
    tickets.map((ticket) => ({
      key: formatTicketKey(project.key, ticket.num),
      title: ticket.title,
      priority: ticket.priority,
    })),
    limit,
  );
  const target = {
    chatId: null,
    resumeSessionId: null,
    askModel: null,
    askMode: null,
    role: 'work' as const,
  };
  const batch = queuedRunRow(queued, {
    ...target,
    id: batchId,
    kind: 'batch',
    ticketId: null,
    prompt,
    askEffort: null,
  });
  // A millisecond apart, so the batch lists its tickets in the order Claude gets them.
  const held = tickets.map((ticket, index) =>
    queuedRunRow(
      { ...queued, now: queued.now + index },
      { ...target, kind: 'ticket', ticketId: ticket.id, batchId, prompt: '', askEffort: null },
    ),
  );
  return { batch, held };
}

// In one transaction, so no helper takes the batch before its tickets are held and no read ends
// them as left over. A ticket that started since the pick fails the whole batch rather than leave
// it in the prompt.
async function insertBatch(trx: Db, rows: { batch: RunRow; held: RunRow[] }): Promise<void> {
  try {
    await insertRun(trx, rows.batch);
    for (const row of rows.held) await insertRun(trx, row);
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(RACED);
    throw error;
  }
}

export interface RunAllRequest {
  projectKey: string;
  input: RunAllInput;
  // Runs in the batch's transaction, so whatever it records goes or stays with the batch.
  onQueued?: ((trx: Db, batchId: string) => Promise<void>) | undefined;
  // The ticket keys a card showed; the batch runs exactly these or nothing.
  shown?: readonly string[] | undefined;
}

function requireShown(project: ProjectRow, pick: RunAllPick, shown: readonly string[]): void {
  const picked = pick.tickets.map((ticket) => formatTicketKey(project.key, ticket.num));
  if (!sameTicketKeys(shown, picked)) throw conflict(CHANGED);
}

export async function runAllTodo(
  ctx: ServiceContext,
  scope: UserScope,
  { projectKey, input, onQueued, shown }: RunAllRequest,
): Promise<RunAllResult> {
  const project = await requireProject(ctx.db, scope, projectKey);
  const runner = await requireRunnerFor(ctx, scope, input.runnerId, project);
  await expireSilentRuns(ctx);
  const maxParallel = maxParallelOf(input);
  const queued = { scope, runner, projectId: project.id, now: ctx.now() };
  const outcome = await inTransaction(ctx, async (trx) => {
    const pick = await pickTodo(trx, project);
    if (shown) requireShown(project, pick, shown);
    if (pick.tickets.length === 0) return { pick, rows: null };
    const rows = batchRows(queued, project, pick.tickets, maxParallel);
    await insertBatch(trx, rows);
    await onQueued?.(trx, rows.batch.id);
    return { pick, rows };
  });
  if (outcome.rows) {
    for (const row of [outcome.rows.batch, ...outcome.rows.held]) notifyRun(ctx, scope, row);
  }
  return {
    runId: outcome.rows?.batch.id ?? null,
    queued: outcome.pick.tickets.length,
    skippedActive: outcome.pick.skippedActive,
    skippedDevice: outcome.pick.skippedDevice,
    leftOver: outcome.pick.leftOver,
    maxParallel,
  };
}
