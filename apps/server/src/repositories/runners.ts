import type { UserScope } from '../auth/scope';
import type { RunnerRow } from '../db/runTables';
import type { Db } from '../db/schema';

// Any user's: the caller decides what a runner of another user means.
export const findRunnerRow = (db: Db, id: string) =>
  db.selectFrom('runners').selectAll().where('id', '=', id).executeTakeFirst();

export const listRunnerRows = (db: Db, userId: UserScope) => {
  const query = db.selectFrom('runners').selectAll().orderBy('createdAt').orderBy('id');
  return (
    userId === null ? query.where('userId', 'is', null) : query.where('userId', '=', userId)
  ).execute();
};

export async function insertRunner(db: Db, row: RunnerRow): Promise<void> {
  await db.insertInto('runners').values(row).execute();
}

export async function updateRunnerRow(
  db: Db,
  id: string,
  changes: Partial<Pick<RunnerRow, 'name' | 'projectIds' | 'lastSeenAt'>>,
): Promise<void> {
  await db.updateTable('runners').set(changes).where('id', '=', id).execute();
}

export async function deleteRunnerRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('runners').where('id', '=', id).execute();
}
