import { describe, expect, it } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import type { StoredDraft } from '../../../lib/storedDrafts';
import { checkDraft, serverText } from './draftCheck';

const draft = (overrides: Partial<StoredDraft>): StoredDraft => ({
  ticketKey: 'MOB-1',
  field: 'description',
  base: 'Old',
  text: 'Mine',
  ...overrides,
});

describe('checkDraft', () => {
  it('says whether the tracker has the text, still has its base, or changed meanwhile', () => {
    expect(checkDraft(draft({}), 'Mine')).toBe('saved');
    expect(checkDraft(draft({}), 'Old')).toBe('unchanged');
    expect(checkDraft(draft({}), 'Theirs')).toBe('changed');
    expect(checkDraft(draft({}), undefined)).toBe('gone');
  });

  it('ignores spaces around names and comments, which the server trims', () => {
    expect(checkDraft(draft({ field: 'assignee', base: '', text: ' Dara ' }), 'Dara')).toBe(
      'saved',
    );
    const edit = draft({ field: 'comment-edit', activityId: 'c1', base: 'Hi', text: 'Hi all ' });
    expect(checkDraft(edit, 'Hi all')).toBe('saved');
    expect(checkDraft(draft({ base: 'Old ', text: 'Mine' }), 'Old')).toBe('changed');
  });
});

describe('serverText', () => {
  const detail = makeTicketDetail(
    listItem(1, STATUS.todo, 0, { title: 'T', description: 'D', assignee: 'Dara' }),
    { activity: [comment('c1', 'First thought')] },
  );

  it('reads the field or comment the draft is for', () => {
    expect(serverText(detail, draft({ field: 'title' }))).toBe('T');
    expect(serverText(detail, draft({ field: 'description' }))).toBe('D');
    expect(serverText(detail, draft({ field: 'assignee' }))).toBe('Dara');
    expect(serverText(detail, draft({ field: 'comment-edit', activityId: 'c1' }))).toBe(
      'First thought',
    );
  });

  it('has nothing for a deleted comment or for the comment box', () => {
    expect(
      serverText(detail, draft({ field: 'comment-edit', activityId: 'gone' })),
    ).toBeUndefined();
    expect(serverText(detail, draft({ field: 'comment' }))).toBeUndefined();
  });
});
