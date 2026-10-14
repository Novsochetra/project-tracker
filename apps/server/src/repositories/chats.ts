import type { RunStepKind } from '@tracker/shared';
import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { ChatMessageRow, ChatRow } from '../db/chatTables';
import type { Database, Db } from '../db/schema';
import { notQueued } from './chatQueue';

export interface ChatWithKey extends ChatRow {
  projectKey: string;
  projectName: string;
  waiting: number | boolean;
  ticketNum: number | null;
  ticketTitle: string | null;
}

export interface MessageWithSteps extends ChatMessageRow {
  stepCount: number | null;
  lastStepKind: RunStepKind | null;
  lastStepLabel: string | null;
  lastStepSubAgent: number | null;
  costMicros: number | null;
  turns: number | null;
  durationMs: number | null;
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
    .leftJoin('tickets as chatTicket', 'chatTicket.id', 'chats.ticketId')
    .selectAll('chats')
    .select(['projects.key as projectKey', 'projects.name as projectName'])
    .select(['chatTicket.num as ticketNum', 'chatTicket.title as ticketTitle'])
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
    .leftJoin('runs', 'runs.id', 'chatMessages.runId')
    // A step's seq counts the run's steps, so the last one's is the run's stepCount.
    .leftJoin('runSteps as lastStep', (join) =>
      join.onRef('lastStep.runId', '=', 'runs.id').onRef('lastStep.seq', '=', 'runs.stepCount'),
    )
    .selectAll('chatMessages')
    .select('runs.stepCount')
    .select([
      'lastStep.kind as lastStepKind',
      'lastStep.label as lastStepLabel',
      'lastStep.subAgent as lastStepSubAgent',
    ])
    .select(['runs.costMicros', 'runs.turns', 'runs.durationMs'])
    .where('chatMessages.chatId', '=', chatId)
    // A queued message joins the thread when its own run starts.
    .where(notQueued)
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

// The chat lists its messages by createdAt then id, so later means later in that order.
export const listLaterClaudeTexts = (db: Db, message: ChatMessageRow) =>
  db
    .selectFrom('chatMessages')
    .select('text')
    .where('chatId', '=', message.chatId)
    .where('role', '=', 'claude')
    .where((eb) =>
      eb.or([
        eb('createdAt', '>', message.createdAt),
        eb.and([eb('createdAt', '=', message.createdAt), eb('id', '>', message.id)]),
      ]),
    )
    .execute();

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

// Only a card that has no batch yet takes one, so two taps on Confirm that race start one batch.
export async function claimMessageBatch(db: Db, id: string, batchRunId: string): Promise<boolean> {
  const result = await db
    .updateTable('chatMessages')
    .set({ batchRunId })
    .where('id', '=', id)
    .where('batchRunId', 'is', null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export const assignOwnerlessChats = (db: Db, userId: string) =>
  db.updateTable('chats').set({ userId }).where('userId', 'is', null).execute();

export async function deleteChatRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('chats').where('id', '=', id).execute();
}
