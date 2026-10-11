import type { RunStepKind } from '@tracker/shared';
import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { ChatMessageRow, ChatRow } from '../db/chatTables';
import type { Database, Db } from '../db/schema';

export interface ChatWithKey extends ChatRow {
  projectKey: string;
  waiting: number | boolean;
}

export interface MessageWithKey extends ChatMessageRow {
  projectKey: string | null;
  ticketNum: number | null;
  stepCount: number | null;
  lastStepKind: RunStepKind | null;
  lastStepLabel: string | null;
  lastStepSubAgent: number | null;
}

// '=' never matches a null user, so the open tracker's rows need 'is'.
const ownedBy = (userId: UserScope) => (eb: ExpressionBuilder<Database, 'chats'>) =>
  userId === null ? eb('chats.userId', 'is', null) : eb('chats.userId', '=', userId);

// Requests are ended lazily (settleRequests), so one past its deadline or of an ended run may
// still say open: only a live one counts.
const waitingAt = (now: number) => (eb: ExpressionBuilder<Database, 'chats'>) =>
  eb
    .exists(
      eb
        .selectFrom('runRequests')
        .innerJoin('runs', 'runs.id', 'runRequests.runId')
        .select('runRequests.id')
        .whereRef('runs.chatId', '=', 'chats.id')
        .where('runs.status', '=', 'running')
        .where('runRequests.status', '=', 'open')
        .where('runRequests.expiresAt', '>', now),
    )
    .as('waiting');

const chatsOf = (db: Db, userId: UserScope, now: number) =>
  db
    .selectFrom('chats')
    .innerJoin('projects', 'projects.id', 'chats.projectId')
    .selectAll('chats')
    .select('projects.key as projectKey')
    .select(waitingAt(now))
    .where(ownedBy(userId));

export const findChatInScope = (db: Db, userId: UserScope, id: string, now: number) =>
  chatsOf(db, userId, now).where('chats.id', '=', id).executeTakeFirst();

export const listProjectChatRows = (
  db: Db,
  userId: UserScope,
  projectId: string,
  { limit, now }: { limit: number; now: number },
) =>
  chatsOf(db, userId, now)
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
    .leftJoin('runs', 'runs.id', 'chatMessages.runId')
    // A step's seq counts the run's steps, so the last one's is the run's stepCount.
    .leftJoin('runSteps as lastStep', (join) =>
      join.onRef('lastStep.runId', '=', 'runs.id').onRef('lastStep.seq', '=', 'runs.stepCount'),
    )
    .selectAll('chatMessages')
    .select(['projects.key as projectKey', 'tickets.num as ticketNum', 'runs.stepCount'])
    .select([
      'lastStep.kind as lastStepKind',
      'lastStep.label as lastStepLabel',
      'lastStep.subAgent as lastStepSubAgent',
    ])
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
    Pick<
      ChatRow,
      'sessionId' | 'sessionRunnerId' | 'updatedAt' | 'askModel' | 'askMode' | 'askEffort'
    >
  >,
): Promise<void> {
  await db.updateTable('chats').set(changes).where('id', '=', id).execute();
}

export async function setMessageTicket(db: Db, id: string, ticketId: string): Promise<void> {
  await db.updateTable('chatMessages').set({ ticketId }).where('id', '=', id).execute();
}

export const assignOwnerlessChats = (db: Db, userId: string) =>
  db.updateTable('chats').set({ userId }).where('userId', 'is', null).execute();

export async function deleteChatRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('chats').where('id', '=', id).execute();
}
