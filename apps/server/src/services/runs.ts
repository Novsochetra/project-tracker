import { randomUUID } from 'node:crypto';
import {
  RUN_NOT_TAKEN,
  RUN_PICKUP_MS,
  type EndedRunStatus,
  type FinishRunInput,
  type Run,
  type StartRunInput,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { isUniqueViolation } from '../db/errors';
import type { RunRow } from '../db/runTables';
import { conflict, notFound } from '../errors';
import {
  failQueuedRunsBefore,
  findRunInScope,
  insertRun,
  listTicketRunRows,
  markRunEnded,
  type RunWithKey,
} from '../repositories/runs';
import type { ServiceContext } from './context';
import { requireTicket, ticketKeyOf } from './lookups';
import { notifyRun, parseProjectIds, toRun } from './runMappers';
import { requireRunner } from './runners';

const TICKET_RUNS_SHOWN = 20;

// Rows of every user: each event goes to its own user's streams.
export async function expireUntakenRuns(ctx: ServiceContext): Promise<void> {
  const now = ctx.now();
  const expired = await failQueuedRunsBefore(ctx.db, now - RUN_PICKUP_MS, RUN_NOT_TAKEN, now);
  for (const row of expired) notifyRun(ctx, row.userId, row);
}

// Another user's run answers like one that doesn't exist, so nobody learns it does.
export async function requireRun(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<RunWithKey> {
  const row = await findRunInScope(ctx.db, scope, id);
  if (!row) throw notFound('That run was not found.');
  return row;
}

export async function startRun(
  ctx: ServiceContext,
  scope: UserScope,
  ticketKey: string,
  input: StartRunInput,
): Promise<Run> {
  const ref = await requireTicket(ctx.db, ticketKey);
  const runner = await requireRunner(ctx, scope, input.runnerId);
  if (!parseProjectIds(runner).includes(ref.project.id)) {
    throw conflict(`${runner.name} doesn't run ${ref.project.key}. Start tracker watch there.`);
  }
  await expireUntakenRuns(ctx);
  const row: RunRow = {
    id: randomUUID(),
    userId: scope,
    projectId: ref.project.id,
    ticketId: ref.ticket.id,
    runnerId: runner.id,
    runnerName: runner.name,
    prompt: input.prompt.trim(),
    status: 'queued',
    error: null,
    createdAt: ctx.now(),
    startedAt: null,
    endedAt: null,
  };
  try {
    await insertRun(ctx.db, row);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    throw conflict(`Claude is already working on ${ticketKeyOf(ref)}.`);
  }
  notifyRun(ctx, scope, row);
  return toRun(await requireRun(ctx, scope, row.id));
}

export async function listTicketRuns(
  ctx: ServiceContext,
  scope: UserScope,
  ticketKey: string,
): Promise<Run[]> {
  const ref = await requireTicket(ctx.db, ticketKey);
  await expireUntakenRuns(ctx);
  const rows = await listTicketRunRows(ctx.db, scope, ref.ticket.id, TICKET_RUNS_SHOWN);
  return rows.map(toRun);
}

export async function getRun(ctx: ServiceContext, scope: UserScope, id: string): Promise<Run> {
  await expireUntakenRuns(ctx);
  return toRun(await requireRun(ctx, scope, id));
}

// Saying the same end twice is fine: a helper retries a report the server may already have, and a
// helper reports "cancelled" after the person cancelled.
export async function endRun(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: FinishRunInput,
): Promise<Run> {
  await expireUntakenRuns(ctx);
  const status: EndedRunStatus = input.status;
  const error = status === 'done' ? null : input.error?.trim() || null;
  const before = await requireRun(ctx, scope, id);
  const ended = await markRunEnded(ctx.db, before.id, { status, error, endedAt: ctx.now() });
  const after = await requireRun(ctx, scope, id);
  if (!ended && after.status !== status) {
    throw conflict(`This run already ended (${after.status}).`);
  }
  if (ended) notifyRun(ctx, scope, after);
  return toRun(after);
}

export const cancelRun = (ctx: ServiceContext, scope: UserScope, id: string): Promise<Run> =>
  endRun(ctx, scope, id, { status: 'cancelled' });
