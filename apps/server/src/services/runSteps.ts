import type { AddRunStepsInput, RunStep } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRow, RunStepRow } from '../db/runTables';
import { conflict, forbidden } from '../errors';
import {
  countMoreSteps,
  dropOldSteps,
  insertRunSteps,
  listRunStepRows,
} from '../repositories/runSteps';
import { inTransaction, type ServiceContext } from './context';
import { requireRun } from './runs';

const toStep = (row: RunStepRow): RunStep => ({
  seq: row.seq,
  kind: row.kind,
  label: row.label,
  subAgent: row.subAgent === 1,
  toolId: row.toolId,
  at: row.createdAt,
});

type Steps = AddRunStepsInput['steps'];

const rowsOf = (runId: string, steps: Steps, count: number, at: number) =>
  steps.map((step, index): RunStepRow => ({
    runId,
    seq: count - steps.length + index + 1,
    kind: step.kind,
    label: step.label,
    subAgent: step.subAgent ? 1 : 0,
    toolId: step.toolId ?? null,
    createdAt: at,
  }));

function notifyRunStep(ctx: ServiceContext, scope: UserScope, run: RunRow, count: number): void {
  ctx.runEvents.publish({
    userId: scope,
    event: {
      type: 'run-step',
      runId: run.id,
      projectId: run.projectId,
      ticketId: run.ticketId,
      chatId: run.chatId,
      count,
    },
  });
}

const notRunning = (run: RunRow) =>
  conflict(
    run.status === 'queued'
      ? 'This run has not started yet.'
      : `This run already ended (${run.status}).`,
  );

export async function addRunSteps(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: AddRunStepsInput,
): Promise<void> {
  const run = await requireRun(ctx, scope, id);
  if (run.runnerId !== input.runnerId) {
    throw forbidden('Only the helper that took this run sends its steps.');
  }
  const { steps } = input;
  const at = ctx.now();
  const count = await inTransaction(ctx, async (trx) => {
    const counted = await countMoreSteps(trx, run.id, steps.length);
    if (counted === undefined) return undefined;
    await insertRunSteps(trx, rowsOf(run.id, steps, counted, at));
    await dropOldSteps(trx, run.id, counted);
    return counted;
  });
  if (count === undefined) throw notRunning(await requireRun(ctx, scope, id));
  notifyRunStep(ctx, scope, run, count);
}

// Kept after the run ends: they are what it did.
export async function listRunSteps(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  after: number,
): Promise<RunStep[]> {
  const run = await requireRun(ctx, scope, id);
  return (await listRunStepRows(ctx.db, run.id, after)).map(toStep);
}
