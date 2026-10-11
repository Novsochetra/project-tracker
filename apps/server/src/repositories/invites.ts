import type { InviteRow, LinkKind } from '../db/authTables';
import type { Db } from '../db/schema';

export async function insertInvite(db: Db, row: InviteRow): Promise<void> {
  await db.insertInto('invites').values(row).execute();
}

export const findLinkByHash = (db: Db, kind: LinkKind, tokenHash: string) =>
  db
    .selectFrom('invites')
    .selectAll()
    .where('kind', '=', kind)
    .where('tokenHash', '=', tokenHash)
    .executeTakeFirst();

const openLinks = (db: Db, kind: LinkKind, now: number) =>
  db
    .selectFrom('invites')
    .selectAll()
    .where('kind', '=', kind)
    .where('usedAt', 'is', null)
    .where('expiresAt', '>', now);

export const listOpenInviteRows = (db: Db, createdBy: string, now: number) =>
  openLinks(db, 'invite', now)
    .where('createdBy', '=', createdBy)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export const listOpenResetRows = (db: Db, now: number) => openLinks(db, 'reset', now).execute();

export async function deleteOpenInvite(db: Db, createdBy: string, id: string): Promise<number> {
  const result = await db
    .deleteFrom('invites')
    .where('id', '=', id)
    .where('kind', '=', 'invite')
    .where('createdBy', '=', createdBy)
    .where('usedAt', 'is', null)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}

export async function deleteOpenResets(db: Db, userId: string): Promise<number> {
  const result = await db
    .deleteFrom('invites')
    .where('kind', '=', 'reset')
    .where('userId', '=', userId)
    .where('usedAt', 'is', null)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}

// Conditional, so of two uses at once only one gets the link.
export async function useLinkRow(
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
