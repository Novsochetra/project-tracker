import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { RunnerRow } from '../db/runTables';
import type { Database, Db } from '../db/schema';

const ownedBy = (userId: UserScope) => (eb: ExpressionBuilder<Database, 'runners'>) =>
  userId === null ? eb('userId', 'is', null) : eb('userId', '=', userId);

// Any user's: a helper id another user took must answer 404, not become a new helper.
export const findRunnerRow = (db: Db, id: string) =>
  db.selectFrom('runners').selectAll().where('id', '=', id).executeTakeFirst();

export const listRunnerRows = (db: Db, userId: UserScope) =>
  db
    .selectFrom('runners')
    .selectAll()
    .where(ownedBy(userId))
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export async function insertRunner(db: Db, row: RunnerRow): Promise<void> {
  await db.insertInto('runners').values(row).execute();
}

export async function updateRunnerRow(
  db: Db,
  userId: UserScope,
  id: string,
  changes: Partial<Pick<RunnerRow, 'name' | 'projectIds' | 'tools' | 'planLimits' | 'lastSeenAt'>>,
): Promise<void> {
  await db
    .updateTable('runners')
    .set(changes)
    .where(ownedBy(userId))
    .where('id', '=', id)
    .execute();
}

export async function deleteRunnerRow(db: Db, userId: UserScope, id: string): Promise<void> {
  await db.deleteFrom('runners').where(ownedBy(userId)).where('id', '=', id).execute();
}

export const assignOwnerlessRunners = (db: Db, userId: string) =>
  db.updateTable('runners').set({ userId }).where('userId', 'is', null).execute();
