import type { ApiTokenRow } from '../db/authTables';
import type { Db } from '../db/schema';

export const listApiTokenRows = (db: Db, userId: string) =>
  db
    .selectFrom('apiTokens')
    .selectAll()
    .where('userId', '=', userId)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export const findApiTokenByHash = (db: Db, tokenHash: string) =>
  db.selectFrom('apiTokens').selectAll().where('tokenHash', '=', tokenHash).executeTakeFirst();

export const findApiTokenById = (db: Db, id: string) =>
  db.selectFrom('apiTokens').select('id').where('id', '=', id).executeTakeFirst();

export async function insertApiToken(db: Db, row: ApiTokenRow): Promise<void> {
  await db.insertInto('apiTokens').values(row).execute();
}

export async function touchApiToken(db: Db, id: string, lastUsedAt: number): Promise<void> {
  await db.updateTable('apiTokens').set({ lastUsedAt }).where('id', '=', id).execute();
}

export async function deleteApiTokenRow(db: Db, id: string, userId: string): Promise<number> {
  const result = await db
    .deleteFrom('apiTokens')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}
