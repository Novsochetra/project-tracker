import type { AttachmentRow } from '../db/schema';
import type { TableRows } from './rows';

export interface CopiedRows {
  rows: TableRows;
  pendingLeftOut: number;
  chatFilesLeftOut: number;
}

const isChatFile = (row: AttachmentRow): boolean => row.chatMessageId !== null;

const isPending = (row: AttachmentRow): boolean =>
  row.ticketId === null && row.activityId === null && !isChatFile(row);

// A pending upload (on no ticket or comment yet) can only be attached by the page or agent that
// uploaded it, through the tracker it went to, so online nothing could ever use it; that tracker's
// start-up clean-up removes it after a day. A server stopped during an upload leaves one naming a
// file that is missing or partial, which refused the whole move (PT-133 review). A file sent in a
// chat stays with its chat, which the move leaves behind (tables.ts).
export function withoutPendingUploads(rows: TableRows): CopiedRows {
  const attachments = rows.attachments.filter((row) => !isPending(row) && !isChatFile(row));
  const chatFilesLeftOut = rows.attachments.filter(isChatFile).length;
  return {
    rows: { ...rows, attachments },
    pendingLeftOut: rows.attachments.length - attachments.length - chatFilesLeftOut,
    chatFilesLeftOut,
  };
}

export function leftOutLines({ pendingLeftOut, chatFilesLeftOut }: CopiedRows): string[] {
  const lines: string[] = [];
  if (pendingLeftOut > 0) {
    lines.push(
      `Not copied: ${pendingLeftOut} upload(s) on no ticket or comment yet (files picked for a ` +
        'ticket or comment not created yet, or an upload cut off when the tracker stopped).',
    );
  }
  if (chatFilesLeftOut > 0) {
    lines.push(
      `Not copied: ${chatFilesLeftOut} file(s) sent with questions in chats with Claude Code, ` +
        'which stay on this tracker.',
    );
  }
  return lines;
}
