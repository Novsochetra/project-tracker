import type { SessionRow } from '../db/authTables';
import type { Db } from '../db/schema';

export interface SessionWithEmail extends SessionRow {
  email: string;
}

export const findSessionWithEmail = (db: Db, id: string): Promise<SessionWithEmail | undefined> =>
  db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.userId')
    .selectAll('sessions')
    .select('users.email')
    .where('sessions.id', '=', id)
    .executeTakeFirst();

export const findSessionRow = (db: Db, id: string) =>
  db.selectFrom('sessions').selectAll().where('id', '=', id).executeTakeFirst();

export async function insertSession(db: Db, row: SessionRow): Promise<void> {
  await db.insertInto('sessions').values(row).execute();
}

export async function renewSessionRow(
  db: Db,
  id: string,
  changes: Pick<SessionRow, 'lastSeenAt' | 'expiresAt'>,
): Promise<void> {
  await db.updateTable('sessions').set(changes).where('id', '=', id).execute();
}

export async function deleteSessionRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('sessions').where('id', '=', id).execute();
}

export async function deleteUserSessions(db: Db, userId: string): Promise<number> {
  const result = await db.deleteFrom('sessions').where('userId', '=', userId).executeTakeFirst();
  return Number(result.numDeletedRows);
}

export async function deleteExpiredSessions(db: Db, now: number): Promise<void> {
  await db.deleteFrom('sessions').where('expiresAt', '<=', now).execute();
}
