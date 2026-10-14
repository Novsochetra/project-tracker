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

// Held: an answer stopped or failed after the message was queued, so it waits for Send now.
// Read from the runs rather than kept as a flag, since many paths end a run (Stop, a helper gone
// silent or removed) and each would have to set it.
const heldOf = (eb: ExpressionBuilder<Database, 'chatQueue' | 'chatMessages'>) =>
  eb
    .exists(
      eb
        .selectFrom('runs')
        .select('runs.id')
        .whereRef('runs.chatId', '=', 'chatQueue.chatId')
        .where('runs.status', 'in', ['failed', 'cancelled'])
        .whereRef('runs.endedAt', '>=', 'chatMessages.createdAt'),
    )
    .as('held');

const queuedOf = (db: Db, chatId: string) =>
  db
    .selectFrom('chatQueue')
    .innerJoin('chatMessages', 'chatMessages.id', 'chatQueue.messageId')
    .selectAll('chatQueue')
    .select(['chatMessages.text', 'chatMessages.createdAt'])
    .select(heldOf)
    .where('chatQueue.chatId', '=', chatId);

export type QueuedRow = Awaited<ReturnType<typeof listQueuedRows>>[number];

export const listQueuedRows = (db: Db, chatId: string) =>
  queuedOf(db, chatId).orderBy('chatQueue.position').execute();

export const findQueuedRow = (db: Db, chatId: string, messageId: string) =>
  queuedOf(db, chatId).where('chatQueue.messageId', '=', messageId).executeTakeFirst();

// SQLite answers exists() with 0 or 1, Postgres with a boolean.
export const isHeld = (row: Pick<QueuedRow, 'held'>): boolean => Boolean(row.held);

export async function queueSize(db: Db, chatId: string) {
  const row = await db
    .selectFrom('chatQueue')
    .select((eb) => [
      eb.fn.countAll<number | string>().as('count'),
      eb.fn.max('position').as('last'),
    ])
    .where('chatId', '=', chatId)
    .executeTakeFirstOrThrow();
  return { count: Number(row.count), next: row.last === null ? 0 : Number(row.last) + 1 };
}

export async function insertQueued(db: Db, row: ChatQueueRow): Promise<void> {
  await db.insertInto('chatQueue').values(row).execute();
}

export async function leaveQueue(db: Db, messageId: string): Promise<void> {
  await db.deleteFrom('chatQueue').where('messageId', '=', messageId).execute();
}

export async function updateQueuedText(db: Db, messageId: string, text: string): Promise<void> {
  await db.updateTable('chatMessages').set({ text }).where('id', '=', messageId).execute();
}

// Its files and its queue row go with it by foreign key.
export async function deleteMessage(db: Db, messageId: string): Promise<void> {
  await db.deleteFrom('chatMessages').where('id', '=', messageId).execute();
}

export async function moveMessageTo(db: Db, messageId: string, createdAt: number): Promise<void> {
  await db.updateTable('chatMessages').set({ createdAt }).where('id', '=', messageId).execute();
}

export async function lastMessageAt(db: Db, chatId: string): Promise<number | null> {
  const row = await db
    .selectFrom('chatMessages')
    .select((eb) => eb.fn.max('chatMessages.createdAt').as('last'))
    .where('chatMessages.chatId', '=', chatId)
    .where(notQueued)
    .executeTakeFirst();
  return row?.last === null || row?.last === undefined ? null : Number(row.last);
}

// Every change to a chat's queue and its asks takes this lock first, so two requests that race
// see each other's work: a send never jumps the queue and the cap holds on Postgres too.
export async function lockChat(db: Db, chatId: string): Promise<void> {
  await db
    .updateTable('chats')
    .set((eb) => ({ updatedAt: eb.ref('updatedAt') }))
    .where('id', '=', chatId)
    .execute();
}
