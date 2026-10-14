import type { ChatGitActionRow } from '../db/chatChangeTables';
import type { Db } from '../db/schema';

export async function insertGitAction(db: Db, row: ChatGitActionRow): Promise<void> {
  await db.insertInto('chatGitActions').values(row).execute();
}

export const latestGitAction = (db: Db, chatId: string) =>
  db
    .selectFrom('chatGitActions')
    .selectAll()
    .where('chatId', '=', chatId)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst();

export const findGitAction = (db: Db, id: string) =>
  db.selectFrom('chatGitActions').selectAll().where('id', '=', id).executeTakeFirst();

export const nextQueuedGitAction = (db: Db, runnerId: string) =>
  db
    .selectFrom('chatGitActions')
    .selectAll()
    .where('runnerId', '=', runnerId)
    .where('status', '=', 'queued')
    .orderBy('createdAt')
    .orderBy('id')
    .limit(1)
    .executeTakeFirst();

// Only a queued one is taken, so two takes that race can't both run it.
export async function markGitActionRunning(db: Db, id: string): Promise<boolean> {
  const result = await db
    .updateTable('chatGitActions')
    .set({ status: 'running' })
    .where('id', '=', id)
    .where('status', '=', 'queued')
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export interface GitActionEnding {
  status: 'done' | 'failed';
  error: string | null;
  result: string | null;
  endedAt: number;
}

export const endGitActions = (
  db: Db,
  where: { runnerId: string; status: 'queued' | 'running'; before?: number },
  ending: GitActionEnding,
) =>
  db
    .updateTable('chatGitActions')
    .set(ending)
    .where('runnerId', '=', where.runnerId)
    .where('status', '=', where.status)
    .$if(where.before !== undefined, (qb) => qb.where('createdAt', '<', where.before ?? 0))
    .returningAll()
    .execute();

export async function endGitAction(db: Db, id: string, ending: GitActionEnding): Promise<boolean> {
  const result = await db
    .updateTable('chatGitActions')
    .set(ending)
    .where('id', '=', id)
    .where('status', '=', 'running')
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}
