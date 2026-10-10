import {
  RUN_LOST,
  RUN_NOT_TAKEN,
  HELPER_SILENCE_MS,
  type FinishRunInput,
  type Run,
  type StartRunInput,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { conflict, notFound } from '../errors';
import {
  failRunsOfSilentHelpers,
  findRunInScope,
  listTicketRunRows,
  markRunEnded,
  type RunWithKey,
} from '../repositories/runs';
import { saveAnswer } from './chatAnswers';
import { inTransaction, type ServiceContext } from './context';
import { requireTicket, ticketKeyOf } from './lookups';
import { endingOf } from './runEnding';
import { notifyRun, toRun } from './runMappers';
import { requireRunnerFor } from './runners';
import { insertQueuedRun, queuedRunRow } from './runRows';

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
  const runner = await requireRunnerFor(ctx, scope, input.runnerId, ref.project);
  await expireSilentRuns(ctx);
  const queued = { scope, runner, projectId: ref.project.id, now: ctx.now() };
  const row = queuedRunRow(queued, {
    prompt: input.prompt,
    kind: 'ticket',
    ticketId: ref.ticket.id,
    chatId: null,
    resumeSessionId: null,
  });
  await insertQueuedRun(ctx.db, row, `Claude is already working on ${ticketKeyOf(ref)}.`);
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
  const before = await requireRun(ctx, scope, id);
  const { status, error, answer } = endingOf(before, input);
  const endedAt = ctx.now();
  const ended = await inTransaction(ctx, async (trx) => {
    const marked = await markRunEnded(trx, scope, before.id, { status, error, endedAt });
    if (marked && answer) await saveAnswer(trx, before, { ...answer, at: endedAt });
    return marked;
  });
  const after = await requireRun(ctx, scope, id);
  if (!ended && after.status !== status) {
    throw conflict(`This run already ended (${after.status}).`);
  }
  if (ended) notifyRun(ctx, scope, after);
  return toRun(after);
}

export const cancelRun = (ctx: ServiceContext, scope: UserScope, id: string): Promise<Run> =>
  endRun(ctx, scope, id, { status: 'cancelled' });
