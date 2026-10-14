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

// Each TodoWrite call sends the whole list, so a run keeps only its latest; an earlier call's step
// keeps '[]', which still says it was one.
export async function keepLatestTodos(db: Db, rows: readonly RunStepRow[]): Promise<void> {
  const latest = rows.findLast((row) => row.todos !== null);
  if (!latest) return;
  await db
    .updateTable('runSteps')
    .set({ todos: '[]' })
    .where('runId', '=', latest.runId)
    .where('seq', '<', latest.seq)
    .where('todos', 'is not', null)
    .where('todos', '<>', '[]')
    .execute();
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
