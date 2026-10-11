import type { UserRow } from '../db/authTables';
import type { Db } from '../db/schema';

// The earliest owner, should a second ever appear.
export const findOwner = (db: Db) =>
  db
    .selectFrom('users')
    .selectAll()
    .where('role', '=', 'owner')
    .orderBy('createdAt')
    .orderBy('id')
    .limit(1)
    .executeTakeFirst();

export const findUserById = (db: Db, id: string) =>
  db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();

// Emails are kept lower-case (normalizeEmail).
export const findUserByEmail = (db: Db, email: string) =>
  db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();

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
