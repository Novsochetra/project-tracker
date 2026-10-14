import type { ExpressionBuilder } from 'kysely';
import type { ChatQueueRow } from '../db/chatTables';
import type { Database, Db } from '../db/schema';

export const notQueued = (eb: ExpressionBuilder<Database, 'chatMessages'>) =>
  eb.not(
    eb.exists(
      eb
        .selectFrom('chatQueue')
        .select('chatQueue.messageId')
        .whereRef('chatQueue.messageId', '=', 'chatMessages.id'),
    ),
  );

const queuedOf = (db: Db, chatId: string) =>
  db
    .selectFrom('chatQueue')
    .innerJoin('chatMessages', 'chatMessages.id', 'chatQueue.messageId')
    .selectAll('chatQueue')
    .select(['chatMessages.text', 'chatMessages.createdAt'])
    .where('chatQueue.chatId', '=', chatId);

export type QueuedRow = Awaited<ReturnType<typeof listQueuedRows>>[number];

export const listQueuedRows = (db: Db, chatId: string) =>
  queuedOf(db, chatId).orderBy('chatMessages.createdAt').orderBy('chatMessages.id').execute();

export const findQueuedRow = (db: Db, chatId: string, messageId: string) =>
  queuedOf(db, chatId).where('chatQueue.messageId', '=', messageId).executeTakeFirst();

export async function countQueued(db: Db, chatId: string): Promise<number> {
  const row = await db
    .selectFrom('chatQueue')
    .select((eb) => eb.fn.countAll<number | string>().as('count'))
    .where('chatId', '=', chatId)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

// Two messages can arrive in one millisecond, and the thread and the queue are in time order.
export const laterThan = (now: number, last: number | null): number =>
  last === null ? now : Math.max(now, last + 1);

export async function lastMessageAt(
  db: Db,
  chatId: string,
  queued: boolean,
): Promise<number | null> {
  const row = await db
    .selectFrom('chatMessages')
    .select((eb) => eb.fn.max('chatMessages.createdAt').as('last'))
    .where('chatMessages.chatId', '=', chatId)
    .where((eb) => (queued ? eb.not(notQueued(eb)) : notQueued(eb)))
    .executeTakeFirst();
  return row?.last === null || row?.last === undefined ? null : Number(row.last);
}

export async function insertQueued(db: Db, row: ChatQueueRow): Promise<void> {
  await db.insertInto('chatQueue').values(row).execute();
}

// Leaving the queue is the claim on a message: of two starts that race, one deletes the row.
export async function leaveQueue(db: Db, messageId: string): Promise<boolean> {
  const result = await db
    .deleteFrom('chatQueue')
    .where('messageId', '=', messageId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export async function updateQueuedText(db: Db, messageId: string, text: string): Promise<boolean> {
  const result = await db
    .updateTable('chatMessages')
    .set({ text })
    .where('id', '=', messageId)
    .where('id', 'in', db.selectFrom('chatQueue').select('messageId'))
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

// Its files and its queue row go with it by foreign key.
export async function deleteQueuedMessage(db: Db, messageId: string): Promise<boolean> {
  const result = await db
    .deleteFrom('chatMessages')
    .where('id', '=', messageId)
    .where('id', 'in', db.selectFrom('chatQueue').select('messageId'))
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export async function moveMessageTo(db: Db, messageId: string, createdAt: number): Promise<void> {
  await db.updateTable('chatMessages').set({ createdAt }).where('id', '=', messageId).execute();
}
