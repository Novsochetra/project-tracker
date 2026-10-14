import type { ChatDetail } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import type { Db } from '../../db/schema';
import { conflict } from '../../errors';
import { listMessageAttachmentRows } from '../../repositories/chatAttachments';
import {
  deleteMessage,
  findQueuedRow,
  lockChat,
  updateQueuedText,
} from '../../repositories/chatQueue';
import { findChatInScope } from '../../repositories/chats';
import { removeFiles } from '../../storage/fileStorage';
import { CHAT_BUSY } from '../askRuns';
import { getChat, requireChat } from '../chats';
import { inTransaction, type ServiceContext } from '../context';
import { notifyRun } from '../runMappers';
import { requireRunnerFor } from '../runners';
import { expireSilentRuns } from '../runs';
import { chatIsBusy } from './queueMessage';
import { QUEUED_GONE, startQueuedIn } from './startQueued';

export interface QueuedRef {
  chatId: string;
  messageId: string;
}

async function lockedRow(db: Db, { chatId, messageId }: QueuedRef) {
  await lockChat(db, chatId);
  const row = await findQueuedRow(db, chatId, messageId);
  if (!row) throw conflict(QUEUED_GONE);
  return row;
}

// Held or not, the message starts now as long as Claude isn't answering.
export async function sendQueuedNow(
  ctx: ServiceContext,
  scope: UserScope,
  ref: QueuedRef,
): Promise<ChatDetail> {
  const { id } = await requireChat(ctx, scope, ref.chatId);
  await expireSilentRuns(ctx);
  const run = await inTransaction(ctx, async (db) => {
    const row = await lockedRow(db, { ...ref, chatId: id });
    if (await chatIsBusy(db, scope, id)) throw conflict(CHAT_BUSY);
    const chat = await findChatInScope(db, scope, id, ctx.now());
    if (!chat) throw conflict(QUEUED_GONE);
    const trx = { ...ctx, db };
    const project = { id: chat.projectId, key: chat.projectKey };
    const runner = await requireRunnerFor(trx, scope, row.runnerId, project);
    return startQueuedIn(trx, scope, chat, { row, runner });
  });
  notifyRun(ctx, scope, run);
  return getChat(ctx, scope, id);
}

export async function editQueued(
  ctx: ServiceContext,
  scope: UserScope,
  ref: QueuedRef,
  text: string,
): Promise<ChatDetail> {
  const { id } = await requireChat(ctx, scope, ref.chatId);
  await inTransaction(ctx, async (db) => {
    const row = await lockedRow(db, { ...ref, chatId: id });
    await updateQueuedText(db, row.messageId, text);
  });
  return getChat(ctx, scope, id);
}

// The files go from storage too, as deleting a chat removes them.
export async function removeQueued(
  ctx: ServiceContext,
  scope: UserScope,
  ref: QueuedRef,
): Promise<ChatDetail> {
  const { id } = await requireChat(ctx, scope, ref.chatId);
  const keys = await inTransaction(ctx, async (db) => {
    const row = await lockedRow(db, { ...ref, chatId: id });
    const files = await listMessageAttachmentRows(db, row.messageId);
    await deleteMessage(db, row.messageId);
    return files.map((file) => file.storageKey);
  });
  await removeFiles(ctx.storage, keys);
  return getChat(ctx, scope, id);
}
