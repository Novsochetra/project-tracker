import { keepsLocation, type Attachment } from '@tracker/shared';
import type { RunRow } from '../db/runTables';
import type { AttachmentRow, Db } from '../db/schema';
import { invalidInput } from '../errors';
import {
  linkChatAttachments,
  listChatAttachmentRows,
  listMessageAttachmentRows,
  type ChatFileTarget,
} from '../repositories/chatAttachments';
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

export interface RunFiles {
  files: Attachment[];
  withheld: string[];
}

// Decided here, not on the helper, so an older helper never gets a photo with its location either.
export async function runFiles(db: Db, run: RunRow): Promise<RunFiles> {
  if (run.questionId === null) return { files: [], withheld: [] };
  const rows = await listMessageAttachmentRows(db, run.questionId);
  return {
    files: rows.filter((row) => !keepsLocation(row.mimeType)).map(toAttachment),
    withheld: rows.filter((row) => keepsLocation(row.mimeType)).map((row) => row.fileName),
  };
}
