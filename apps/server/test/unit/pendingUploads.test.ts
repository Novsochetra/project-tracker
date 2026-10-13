import { describe, expect, it } from 'vitest';
import type { AttachmentRow } from '../../src/db/schema';
import { leftOutLines, withoutPendingUploads } from '../../src/dataMove/pendingUploads';
import type { TableRows } from '../../src/dataMove/rows';

const ON_TICKET: AttachmentRow = {
  id: 'f1',
  ticketId: 't1',
  activityId: null,
  fileName: 'photo.webp',
  mimeType: 'image/webp',
  size: 4_800,
  width: 400,
  height: 300,
  storageKey: 'f1.webp',
  position: 0,
  createdAt: 1000,
  userId: null,
  chatMessageId: null,
};

const ON_COMMENT: AttachmentRow = { ...ON_TICKET, id: 'f2', activityId: 'a1' };

const PENDING: AttachmentRow = { ...ON_TICKET, id: 'f3', ticketId: null, size: 0 };

const IN_CHAT: AttachmentRow = { ...ON_TICKET, id: 'f4', ticketId: null, chatMessageId: 'm1' };

const rowsWith = (attachments: AttachmentRow[]): TableRows => ({
  projects: [],
  statuses: [],
  tickets: [],
  activities: [],
  attachments,
  labels: [],
  ticketLabels: [],
});

describe('withoutPendingUploads', () => {
  it('keeps files on a ticket or a comment and counts the pending ones it leaves out', () => {
    const copied = withoutPendingUploads(rowsWith([ON_TICKET, PENDING, ON_COMMENT]));
    expect(copied.rows.attachments).toEqual([ON_TICKET, ON_COMMENT]);
    expect(copied.pendingLeftOut).toBe(1);
  });

  it('leaves files sent in chats behind with their chats, counted apart', () => {
    const copied = withoutPendingUploads(rowsWith([ON_TICKET, IN_CHAT, PENDING]));
    expect(copied.rows.attachments).toEqual([ON_TICKET]);
    expect(copied).toMatchObject({ pendingLeftOut: 1, chatFilesLeftOut: 1 });
  });

  it('leaves the other tables as they are', () => {
    const rows = rowsWith([ON_TICKET]);
    const copied = withoutPendingUploads(rows);
    expect(copied.rows).toEqual(rows);
    expect(copied.pendingLeftOut).toBe(0);
    expect(copied.chatFilesLeftOut).toBe(0);
  });
});

describe('leftOutLines', () => {
  const copied = (pendingLeftOut: number, chatFilesLeftOut: number) => ({
    rows: rowsWith([]),
    pendingLeftOut,
    chatFilesLeftOut,
  });

  it('says how many uploads and chat files were left out, and nothing when none was', () => {
    expect(leftOutLines(copied(0, 0))).toEqual([]);
    expect(leftOutLines(copied(2, 3))).toEqual([
      'Not copied: 2 upload(s) on no ticket or comment yet (files picked for a ticket or ' +
        'comment not created yet, or an upload cut off when the tracker stopped).',
      'Not copied: 3 file(s) sent with questions in chats with Claude Code, which stay on this ' +
        'tracker.',
    ]);
  });
});
