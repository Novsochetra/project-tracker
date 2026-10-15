import { ACTIVE_RUN_STATUSES, RUN_STEPS_KEPT } from '@tracker/shared';
import type { Db } from '../db/schema';

// A batch's ticket run is queued until its sub agent claims the ticket, and its Start step comes
// first, so either active status takes steps.
export async function countMoreTicketSteps(
  db: Db,
  runId: string,
  added: number,
): Promise<number | undefined> {
  const row = await db
    .updateTable('runs')
    .set((eb) => ({ stepCount: eb('stepCount', '+', added) }))
    .where('id', '=', runId)
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .returning('stepCount')
    .executeTakeFirst();
  return row?.stepCount;
}

const startSteps = (db: Db, runIds: readonly string[], toolIds: readonly string[]) =>
  db
    .selectFrom('runSteps')
    .selectAll()
    .where('runId', 'in', runIds)
    .where('kind', '=', 'agent')
    .where('toolId', 'in', toolIds);

// A ticket's run starts with its sub agent's Start step, so that step's toolId says whose it is.
export const listStepOwners = (
  db: Db,
  ticketRunIds: readonly string[],
  toolIds: readonly string[],
) =>
  ticketRunIds.length === 0 || toolIds.length === 0
    ? Promise.resolve([])
    : startSteps(db, ticketRunIds, toolIds).execute();

export const listBatchStarts = (db: Db, batchId: string, toolIds: readonly string[]) =>
  toolIds.length === 0 ? Promise.resolve([]) : startSteps(db, [batchId], toolIds).execute();

// A ticket's Start steps say which sub agent is its own, so they outlive the oldest steps.
export async function dropOldTicketSteps(db: Db, runId: string, count: number): Promise<void> {
  await db
    .deleteFrom('runSteps')
    .where('runId', '=', runId)
    .where('seq', '<=', count - RUN_STEPS_KEPT)
    .where((eb) => eb.or([eb('kind', '<>', 'agent'), eb('subAgent', '=', 1)]))
    .execute();
}
