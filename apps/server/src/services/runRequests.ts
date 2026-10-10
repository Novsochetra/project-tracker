import { randomUUID } from 'node:crypto';
import {
  answerProblem,
  requestExpiresAt,
  type AddRunRequestInput,
  type AnswerRunRequestInput,
  type RunRequest,
  type RunRequestStatus,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRequestRow } from '../db/runTables';
import { conflict, forbidden, invalidInput, notFound } from '../errors';
import {
  findRunRequestRow,
  insertRunRequest,
  listRunRequestRows,
  markRequestAnswered,
} from '../repositories/runRequests';
import { findRunInScope } from '../repositories/runs';
import type { ServiceContext } from './context';
import { notifyRunRequest, toRunRequest } from './runRequestMappers';
import { settleRequests } from './runRequestSweep';
import { requireRun } from './runs';

const ENDED: Readonly<Record<Exclude<RunRequestStatus, 'open'>, string>> = {
  answered: 'This was already answered.',
  expired: 'Nobody answered in time, so Claude went on without it.',
  cancelled: 'Claude no longer waits for this.',
};

// 404 rather than 403 for another user's request, like runs.
export async function requireRunRequest(ctx: ServiceContext, scope: UserScope, id: string) {
  const row = await findRunRequestRow(ctx.db, id);
  const run = row && (await findRunInScope(ctx.db, scope, row.runId));
  if (!row || !run) throw notFound('That request was not found.');
  return { row, run };
}

export async function addRunRequest(
  ctx: ServiceContext,
  scope: UserScope,
  runId: string,
  input: AddRunRequestInput,
): Promise<RunRequest> {
  const run = await requireRun(ctx, scope, runId);
  if (run.runnerId !== input.runnerId) {
    throw forbidden('Only the helper that took this run asks in it.');
  }
  if (run.status !== 'running') throw conflict(`This run is not running (${run.status}).`);
  const now = ctx.now();
  const row: RunRequestRow = {
    id: randomUUID(),
    runId: run.id,
    kind: input.kind,
    label: input.label,
    questions: input.questions === null ? null : JSON.stringify(input.questions),
    status: 'open',
    decision: null,
    answers: null,
    createdAt: now,
    expiresAt: requestExpiresAt(now),
    endedAt: null,
  };
  await insertRunRequest(ctx.db, row);
  notifyRunRequest(ctx, scope, run, row);
  return toRunRequest(row);
}

// Ended ones too, so the phone can show what was picked or that nobody answered.
export async function listRunRequests(
  ctx: ServiceContext,
  scope: UserScope,
  runId: string,
): Promise<RunRequest[]> {
  await settleRequests(ctx);
  const run = await requireRun(ctx, scope, runId);
  return (await listRunRequestRows(ctx.db, run.id)).map(toRunRequest);
}

export async function answerRunRequest(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: AnswerRunRequestInput,
): Promise<RunRequest> {
  await settleRequests(ctx);
  const { row, run } = await requireRunRequest(ctx, scope, id);
  const problem = answerProblem(toRunRequest(row), input);
  if (problem) throw invalidInput(problem);
  const answer = {
    decision: input.decision,
    answers: input.answers === undefined ? null : JSON.stringify(input.answers),
    endedAt: ctx.now(),
  };
  const answered = await markRequestAnswered(ctx.db, row.id, answer);
  if (!answered) await settleRequests(ctx);
  const after = (await requireRunRequest(ctx, scope, id)).row;
  if (!answered) throw conflict(after.status === 'open' ? ENDED.cancelled : ENDED[after.status]);
  notifyRunRequest(ctx, scope, run, after);
  return toRunRequest(after);
}
