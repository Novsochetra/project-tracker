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
};

const ON_COMMENT: AttachmentRow = { ...ON_TICKET, id: 'f2', activityId: 'a1' };

const PENDING: AttachmentRow = { ...ON_TICKET, id: 'f3', ticketId: null, size: 0 };

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

  it('leaves the other tables as they are', () => {
    const rows = rowsWith([ON_TICKET]);
    const copied = withoutPendingUploads(rows);
    expect(copied.rows).toEqual(rows);
    expect(copied.pendingLeftOut).toBe(0);
  });
});

describe('leftOutLines', () => {
  const copied = (pendingLeftOut: number) => ({ rows: rowsWith([]), pendingLeftOut });

  it('says how many files on no ticket or comment were left out, and nothing when none was', () => {
    expect(leftOutLines(copied(0))).toEqual([]);
    expect(leftOutLines(copied(2))).toEqual([
      'Not copied: 2 file(s) on no ticket or comment (picked for a ticket or comment not ' +
        'created yet, cut off when the tracker stopped, or sent in a chat).',
    ]);
  });
});
