import type { AttachmentRow } from '../db/schema';
import type { TableRows } from './rows';

export interface CopiedRows {
  rows: TableRows;
  pendingLeftOut: number;
}

const isPending = (row: AttachmentRow): boolean => row.ticketId === null && row.activityId === null;

// A pending upload (on no ticket or comment yet) can only be attached by the page or agent that
// uploaded it, through the tracker it went to, so online nothing could ever use it; that tracker's
// start-up clean-up removes it after a day. A server stopped during an upload leaves one naming a
// file that is missing or partial, which refused the whole move (PT-133 review).
export function withoutPendingUploads(rows: TableRows): CopiedRows {
  const attachments = rows.attachments.filter((row) => !isPending(row));

  return {
    rows: { ...rows, attachments },
    pendingLeftOut: rows.attachments.length - attachments.length,
  };
}

export function leftOutLines({ pendingLeftOut }: CopiedRows): string[] {
  if (pendingLeftOut === 0) return [];

  return [
    `Not copied: ${pendingLeftOut} file(s) on no ticket or comment (picked for a ticket or ` +
      'comment not created yet, cut off when the tracker stopped, or sent in a chat).',
  ];
}
