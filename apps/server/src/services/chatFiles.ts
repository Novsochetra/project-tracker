import type { Attachment } from '@tracker/shared';
import type { RunRow } from '../db/runTables';
import type { AttachmentRow, Db } from '../db/schema';
import { invalidInput } from '../errors';
import {
  linkChatAttachments,
  listChatAttachmentRows,
  listMessageAttachmentRows,
  type ChatFileTarget,
} from '../repositories/chatAttachments';
import { listMessageRows } from '../repositories/chats';
import { toAttachment } from './mappers';

// Another user's file, one already sent or attached, and one that expired are all refused alike.
export async function sendChatFiles(
  db: Db,
  ids: readonly string[],
  target: ChatFileTarget,
): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  if ((await linkChatAttachments(db, unique, target)) !== unique.length) {
    throw invalidInput('Some files could not be sent. Upload them again.');
  }
  return (await listMessageAttachmentRows(db, target.messageId)).map((row) => row.fileName);
}

export async function chatFilesByMessage(
  db: Db,
  chatId: string,
): Promise<Map<string, AttachmentRow[]>> {
  const byMessage = new Map<string, AttachmentRow[]>();
  for (const row of await listChatAttachmentRows(db, chatId)) {
    if (row.chatMessageId === null) continue;
    byMessage.set(row.chatMessageId, [...(byMessage.get(row.chatMessageId) ?? []), row]);
  }
  return byMessage;
}

export async function runFiles(db: Db, run: RunRow): Promise<Attachment[]> {
  if (run.questionId === null) return [];
  return (await listMessageAttachmentRows(db, run.questionId)).map(toAttachment);
}

// For a helper that can't resume the session: each message with the names of the files sent with it.
export async function chatHistory(db: Db, chatId: string) {
  const files = await chatFilesByMessage(db, chatId);
  return (await listMessageRows(db, chatId)).map(({ id, role, text }) => ({
    role,
    text,
    files: (files.get(id) ?? []).map((file) => file.fileName),
  }));
}
