import type { AddRunStepsInput, RunStep } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRow, RunStepRow } from '../db/runTables';
import { conflict, forbidden } from '../errors';
import {
  countMoreSteps,
  dropOldSteps,
  insertRunSteps,
  keepLatestTodos,
  listRunStepRows,
} from '../repositories/runSteps';
import { inTransaction, type ServiceContext } from './context';
import { requireRun } from './runs';
import { addBatchTicketSteps } from './batchSteps';
import { asRunStep, rowsOf } from './runStepRows';
import { todosOfColumn } from './runTodos';

function toStep(row: RunStepRow): RunStep {
  const todos = todosOfColumn(row.todos);
  return {
    seq: row.seq,
    kind: row.kind,
    label: row.label,
    subAgent: row.subAgent === 1,
    toolId: row.toolId,
    ...(todos && { todos }),
    at: row.createdAt,
  };
}

type StepRun = Pick<RunRow, 'id' | 'projectId' | 'ticketId' | 'chatId'>;

function notifyRunStep(ctx: ServiceContext, scope: UserScope, run: StepRun, count: number): void {
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
  const steps = input.steps.map(asRunStep);
  const at = ctx.now();
  const added = await inTransaction(ctx, async (trx) => {
    const counted = await countMoreSteps(trx, run.id, steps.length);
    if (counted === undefined) return undefined;
    const rows = rowsOf(run.id, steps, counted, at);
    await insertRunSteps(trx, rows);
    await keepLatestTodos(trx, rows);
    await dropOldSteps(trx, run.id, counted);
    const tickets = await addBatchTicketSteps(trx, run, steps, at);
    return { count: counted, tickets };
  });
  if (added === undefined) throw notRunning(await requireRun(ctx, scope, id));
  notifyRunStep(ctx, scope, run, added.count);
  for (const ticket of added.tickets) notifyRunStep(ctx, scope, ticket.run, ticket.count);
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
