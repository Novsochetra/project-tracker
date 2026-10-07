import { describe, expect, it } from 'vitest';
import { attachment, comment, listItem, makeTicketDetail, STATUS } from '../test/fixtures';
import {
  addTicketAttachment,
  appendActivity,
  draftComment,
  editActivityText,
  isTemporaryId,
  patchTicketDetail,
  removeActivity,
  removeAttachment,
  replaceActivity,
  withTicket,
} from './ticketDetail';

describe('patchTicketDetail', () => {
  it('patches fields and keeps the status object in sync', () => {
    const detail = patchTicketDetail(makeTicketDetail(), {
      title: 'New title',
      statusId: STATUS.done,
    });
    expect(detail.ticket).toMatchObject({ title: 'New title', statusId: STATUS.done });
    expect(detail.status.id).toBe(STATUS.done);
  });

  it('keeps the old status object when the status is unknown', () => {
    const detail = withTicket(makeTicketDetail(), {
      ...makeTicketDetail().ticket,
      statusId: 's-missing',
    });
    expect(detail.status.id).toBe(STATUS.todo);
  });
});

describe('comment helpers', () => {
  const start = makeTicketDetail(listItem(1, STATUS.todo, 0), {
    activity: [comment('a1', 'First'), comment('a2', 'Second')],
  });

  it('appends a draft comment from the person with a temporary id', () => {
    const draft = draftComment(start, {
      id: 'temp-1',
      text: 'Hi',
      attachments: [],
      createdAt: 5,
    });
    const detail = appendActivity(start, draft);
    expect(detail.activity.map((item) => item.id)).toEqual(['a1', 'a2', 'temp-1']);
    expect(draft).toMatchObject({ ticketId: 't-1', type: 'comment', actor: { kind: 'human' } });
    expect(isTemporaryId(draft.id)).toBe(true);
    expect(isTemporaryId('a1')).toBe(false);
  });

  it('replaces, edits and removes activity by id', () => {
    const replaced = replaceActivity(start, 'a1', comment('server-1', 'First'));
    expect(replaced.activity.map((item) => item.id)).toEqual(['server-1', 'a2']);
    const edited = editActivityText(start, 'a2', 'Changed', 9);
    expect(edited.activity[1]).toMatchObject({ text: 'Changed', editedAt: 9 });
    expect(removeActivity(start, 'a1').activity.map((item) => item.id)).toEqual(['a2']);
  });
});

describe('attachment helpers', () => {
  it('adds a ticket attachment once', () => {
    const once = addTicketAttachment(makeTicketDetail(), attachment('img-1'));
    expect(addTicketAttachment(once, attachment('img-1'))).toBe(once);
    expect(once.attachments.map((item) => item.id)).toEqual(['img-1']);
  });

  it('removes an attachment from the ticket and from comments', () => {
    const detail = makeTicketDetail(listItem(1, STATUS.todo, 0), {
      attachments: [attachment('img-1'), attachment('img-2')],
      activity: [comment('a1', '', { attachments: [attachment('img-1')] }), comment('a2', 'x')],
    });
    const next = removeAttachment(detail, 'img-1');
    expect(next.attachments.map((item) => item.id)).toEqual(['img-2']);
    expect(next.activity[0]?.attachments).toEqual([]);
    expect(next.activity[1]).toBe(detail.activity[1]);
  });
});
