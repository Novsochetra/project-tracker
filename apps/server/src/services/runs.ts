import { randomUUID } from 'node:crypto';
import {
  RUN_LOST,
  RUN_NOT_TAKEN,
  HELPER_SILENCE_MS,
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
  failRunsOfSilentHelpers,
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

export async function expireSilentRuns(ctx: ServiceContext): Promise<void> {
  const endedAt = ctx.now();
  const silentSince = endedAt - HELPER_SILENCE_MS;
  const expired = [
    ...(await failRunsOfSilentHelpers(ctx.db, 'queued', silentSince, {
      error: RUN_NOT_TAKEN,
      endedAt,
    })),
    ...(await failRunsOfSilentHelpers(ctx.db, 'running', silentSince, {
      error: RUN_LOST,
      endedAt,
    })),
  ];
  for (const row of expired) notifyRun(ctx, row.userId, row);
}

// 404 rather than 403, so nobody learns another user's run exists.
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
  await expireSilentRuns(ctx);
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
  await expireSilentRuns(ctx);
  const rows = await listTicketRunRows(ctx.db, scope, ref.ticket.id, TICKET_RUNS_SHOWN);
  return rows.map(toRun);
}

export async function getRun(ctx: ServiceContext, scope: UserScope, id: string): Promise<Run> {
  await expireSilentRuns(ctx);
  return toRun(await requireRun(ctx, scope, id));
}

// The same end twice is fine: a helper retries reports, and says "cancelled" after the person did.
export async function endRun(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: FinishRunInput,
): Promise<Run> {
  await expireSilentRuns(ctx);
  const status: EndedRunStatus = input.status;
  const error = status === 'done' ? null : input.error?.trim() || null;
  const before = await requireRun(ctx, scope, id);
  const ended = await markRunEnded(ctx.db, scope, before.id, { status, error, endedAt: ctx.now() });
  const after = await requireRun(ctx, scope, id);
  if (!ended && after.status !== status) {
    throw conflict(`This run already ended (${after.status}).`);
  }
  if (ended) notifyRun(ctx, scope, after);
  return toRun(after);
}

export const cancelRun = (ctx: ServiceContext, scope: UserScope, id: string): Promise<Run> =>
  endRun(ctx, scope, id, { status: 'cancelled' });
