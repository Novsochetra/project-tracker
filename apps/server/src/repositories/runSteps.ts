import { RUN_STEPS_KEPT } from '@tracker/shared';
import type { RunStepRow } from '../db/runTables';
import type { Db } from '../db/schema';

// Only a running run counts more steps, so none are added once its end is written.
export async function countMoreSteps(
  db: Db,
  runId: string,
  added: number,
): Promise<number | undefined> {
  const row = await db
    .updateTable('runs')
    .set((eb) => ({ stepCount: eb('stepCount', '+', added) }))
    .where('id', '=', runId)
    .where('status', '=', 'running')
    .returning('stepCount')
    .executeTakeFirst();
  return row?.stepCount;
}

export async function insertRunSteps(db: Db, rows: readonly RunStepRow[]): Promise<void> {
  await db.insertInto('runSteps').values(rows).execute();
}

export async function dropOldSteps(db: Db, runId: string, count: number): Promise<void> {
  await db
    .deleteFrom('runSteps')
    .where('runId', '=', runId)
    .where('seq', '<=', count - RUN_STEPS_KEPT)
    .execute();
}

export const listRunStepRows = (db: Db, runId: string, after: number) =>
  db
    .selectFrom('runSteps')
    .selectAll()
    .where('runId', '=', runId)
    .where('seq', '>', after)
    .orderBy('seq')
    .limit(RUN_STEPS_KEPT)
    .execute();
