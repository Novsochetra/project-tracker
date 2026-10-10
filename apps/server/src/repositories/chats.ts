import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { ChatMessageRow, ChatRow } from '../db/chatTables';
import type { Database, Db } from '../db/schema';

export interface ChatWithKey extends ChatRow {
  projectKey: string;
}

export interface MessageWithKey extends ChatMessageRow {
  projectKey: string | null;
  ticketNum: number | null;
}

// '=' never matches a null user, so the open tracker's rows need 'is'.
const ownedBy = (userId: UserScope) => (eb: ExpressionBuilder<Database, 'chats'>) =>
  userId === null ? eb('chats.userId', 'is', null) : eb('chats.userId', '=', userId);

const chatsOf = (db: Db, userId: UserScope) =>
  db
    .selectFrom('chats')
    .innerJoin('projects', 'projects.id', 'chats.projectId')
    .selectAll('chats')
    .select('projects.key as projectKey')
    .where(ownedBy(userId));

export const findChatInScope = (db: Db, userId: UserScope, id: string) =>
  chatsOf(db, userId).where('chats.id', '=', id).executeTakeFirst();

export const listProjectChatRows = (db: Db, userId: UserScope, projectId: string, limit: number) =>
  chatsOf(db, userId)
    .where('chats.projectId', '=', projectId)
    .orderBy('chats.updatedAt', 'desc')
    .orderBy('chats.id', 'desc')
    .limit(limit)
    .execute();

export const listMessageRows = (db: Db, chatId: string) =>
  db
    .selectFrom('chatMessages')
    .leftJoin('tickets', 'tickets.id', 'chatMessages.ticketId')
    .leftJoin('projects', 'projects.id', 'tickets.projectId')
    .selectAll('chatMessages')
    .select(['projects.key as projectKey', 'tickets.num as ticketNum'])
    .where('chatMessages.chatId', '=', chatId)
    .orderBy('chatMessages.createdAt')
    .orderBy('chatMessages.id')
    .execute();

export const findMessage = (db: Db, chatId: string, id: string) =>
  db
    .selectFrom('chatMessages')
    .selectAll()
    .where('chatId', '=', chatId)
    .where('id', '=', id)
    .executeTakeFirst();

export async function insertChat(db: Db, row: ChatRow): Promise<void> {
  await db.insertInto('chats').values(row).execute();
}

export async function insertMessage(db: Db, row: ChatMessageRow): Promise<void> {
  await db.insertInto('chatMessages').values(row).execute();
}

export async function updateChatRow(
  db: Db,
  id: string,
  changes: Partial<
    Pick<ChatRow, 'sessionId' | 'sessionRunnerId' | 'updatedAt' | 'askModel' | 'askMode'>
  >,
): Promise<void> {
  await db.updateTable('chats').set(changes).where('id', '=', id).execute();
}

export async function setMessageTicket(db: Db, id: string, ticketId: string): Promise<void> {
  await db.updateTable('chatMessages').set({ ticketId }).where('id', '=', id).execute();
}

export const assignOwnerlessChats = (db: Db, userId: string) =>
  db.updateTable('chats').set({ userId }).where('userId', 'is', null).execute();
