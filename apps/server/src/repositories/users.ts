import type { UserRow } from '../db/authTables';
import type { Db } from '../db/schema';

// One owner today; the earliest account is the owner should a second row ever appear.
export const findOwner = (db: Db) =>
  db.selectFrom('users').selectAll().orderBy('createdAt').orderBy('id').limit(1).executeTakeFirst();

export const findUserById = (db: Db, id: string) =>
  db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();

export async function insertUser(db: Db, row: UserRow): Promise<void> {
  await db.insertInto('users').values(row).execute();
}

export async function updateUserRow(
  db: Db,
  id: string,
  changes: Partial<Omit<UserRow, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.updateTable('users').set(changes).where('id', '=', id).execute();
}
