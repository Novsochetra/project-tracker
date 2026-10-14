import type { UserScope } from '../auth/scope';
import type { Db } from '../db/schema';
import { pendingOf } from './attachments';

export interface ChatFileTarget {
  messageId: string;
  uploader: UserScope;
}

// Files upload side by side and arrive in any order, so their place comes from `ids`, the order
// they were picked in. Only the sender's own pending uploads can be sent.
export async function linkChatAttachments(
  db: Db,
  ids: readonly string[],
  { messageId, uploader }: ChatFileTarget,
  types?: readonly string[],
): Promise<number> {
  let linked = 0;
  for (const [position, id] of ids.entries()) {
    let update = db
      .updateTable('attachments')
      .set({ chatMessageId: messageId, position })
      .where('id', '=', id)
      .where('activityId', 'is', null)
      .where(pendingOf(uploader));
    // A picture must have been read as an image; bytes that weren't have no width.
    if (types) update = update.where('mimeType', 'in', [...types]).where('width', 'is not', null);
    const result = await update.executeTakeFirst();
    linked += Number(result.numUpdatedRows);
  }
  return linked;
}

export const listChatAttachmentRows = (db: Db, chatId: string) =>
  db
    .selectFrom('attachments')
    .innerJoin('chatMessages', 'chatMessages.id', 'attachments.chatMessageId')
    .selectAll('attachments')
    .where('chatMessages.chatId', '=', chatId)
    .orderBy('attachments.position')
    .orderBy('attachments.createdAt')
    .orderBy('attachments.id')
    .execute();

export const listMessageAttachmentRows = (db: Db, messageId: string) =>
  db
    .selectFrom('attachments')
    .selectAll()
    .where('chatMessageId', '=', messageId)
    .orderBy('position')
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

// The rows go with their chat by foreign key; the files are removed by whoever deletes it.
export async function storageKeysOfChats(
  db: Db,
  column: 'id' | 'projectId',
  value: string,
): Promise<string[]> {
  const rows = await db
    .selectFrom('attachments')
    .innerJoin('chatMessages', 'chatMessages.id', 'attachments.chatMessageId')
    .innerJoin('chats', 'chats.id', 'chatMessages.chatId')
    .select('attachments.storageKey')
    .where(`chats.${column}`, '=', value)
    .execute();
  return rows.map((row) => row.storageKey);
}
