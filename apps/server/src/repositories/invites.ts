import type { InviteRow } from '../db/authTables';
import type { Db } from '../db/schema';

export async function insertInvite(db: Db, row: InviteRow): Promise<void> {
  await db.insertInto('invites').values(row).execute();
}

export const findInviteByHash = (db: Db, tokenHash: string) =>
  db.selectFrom('invites').selectAll().where('tokenHash', '=', tokenHash).executeTakeFirst();

export const listOpenInviteRows = (db: Db, createdBy: string, now: number) =>
  db
    .selectFrom('invites')
    .selectAll()
    .where('createdBy', '=', createdBy)
    .where('usedAt', 'is', null)
    .where('expiresAt', '>', now)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export async function deleteOpenInvite(db: Db, createdBy: string, id: string): Promise<number> {
  const result = await db
    .deleteFrom('invites')
    .where('id', '=', id)
    .where('createdBy', '=', createdBy)
    .where('usedAt', 'is', null)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}

// Conditional, so of two accepts at once only one uses the invite.
export async function useInviteRow(
  db: Db,
  id: string,
  used: { usedBy: string; usedAt: number },
): Promise<boolean> {
  const result = await db
    .updateTable('invites')
    .set(used)
    .where('id', '=', id)
    .where('usedAt', 'is', null)
    .where('expiresAt', '>', used.usedAt)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}
