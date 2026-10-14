import type { ChatDetail } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import { conflict } from '../../errors';
import { listMessageAttachmentRows } from '../../repositories/chatAttachments';
import { deleteQueuedMessage, findQueuedRow, updateQueuedText } from '../../repositories/chatQueue';
import { removeFiles } from '../../storage/fileStorage';
import { CHAT_BUSY } from '../askRuns';
import { getChat, requireChat } from '../chats';
import { inTransaction, type ServiceContext } from '../context';
import { expireSilentRuns } from '../runs';
import { chatIsBusy } from './queueMessage';
import { QUEUED_GONE, startQueued } from './startQueued';

export interface QueuedRef {
  chatId: string;
  messageId: string;
}

export async function sendQueuedNow(
  ctx: ServiceContext,
  scope: UserScope,
  ref: QueuedRef,
): Promise<ChatDetail> {
  const chat = await requireChat(ctx, scope, ref.chatId);
  await expireSilentRuns(ctx);
  if (await chatIsBusy(ctx.db, scope, chat.id)) throw conflict(CHAT_BUSY);
  const row = await findQueuedRow(ctx.db, chat.id, ref.messageId);
  if (!row) throw conflict(QUEUED_GONE);
  await startQueued(ctx, scope, chat, row);
  return getChat(ctx, scope, chat.id);
}

export async function editQueued(
  ctx: ServiceContext,
  scope: UserScope,
  ref: QueuedRef,
  text: string,
): Promise<ChatDetail> {
  const chat = await requireChat(ctx, scope, ref.chatId);
  const row = await findQueuedRow(ctx.db, chat.id, ref.messageId);
  if (!row || !(await updateQueuedText(ctx.db, row.messageId, text))) throw conflict(QUEUED_GONE);
  return getChat(ctx, scope, chat.id);
}

// The files go from storage too, as deleting a chat removes them.
export async function removeQueued(
  ctx: ServiceContext,
  scope: UserScope,
  ref: QueuedRef,
): Promise<ChatDetail> {
  const chat = await requireChat(ctx, scope, ref.chatId);
  const row = await findQueuedRow(ctx.db, chat.id, ref.messageId);
  if (!row) throw conflict(QUEUED_GONE);
  const keys = await inTransaction(ctx, async (trx) => {
    const files = await listMessageAttachmentRows(trx, row.messageId);
    if (!(await deleteQueuedMessage(trx, row.messageId))) throw conflict(QUEUED_GONE);
    return files.map((file) => file.storageKey);
  });
  await removeFiles(ctx.storage, keys);
  return getChat(ctx, scope, chat.id);
}
