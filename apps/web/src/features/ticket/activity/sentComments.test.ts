import { beforeEach, describe, expect, it } from 'vitest';
import { comment, makeTicketDetail } from '../../../api/test/fixtures';
import { keepDraft, storedDraft, storedDrafts } from '../../../lib/storedDrafts';
import { endSend, handBackComment, keptComment, settleLeftSend, startSend } from './sentComments';

const sends = () => storedDrafts().filter(([, draft]) => draft.field === 'comment-send');

beforeEach(() => {
  localStorage.clear();
});

describe('a comment handed back to the box', () => {
  it('comes before text typed meanwhile, once', () => {
    keepDraft('comment:MOB-1', { ticketKey: 'MOB-1', field: 'comment', text: 'Typed' }, '');
    handBackComment('MOB-1', 'Sent');
    expect(keptComment('MOB-1')).toBe('Sent\nTyped');
    handBackComment('MOB-1', 'Sent\nTyped');
    expect(keptComment('MOB-1')).toBe('Sent\nTyped');
  });

  it('fills an empty box', () => {
    handBackComment('MOB-1', 'Sent');
    expect(keptComment('MOB-1')).toBe('Sent');
  });

  it('leaves the box alone for a comment of files only', () => {
    keepDraft('comment:MOB-1', { ticketKey: 'MOB-1', field: 'comment', text: 'Typed' }, '');
    handBackComment('MOB-1', '');
    expect(keptComment('MOB-1')).toBe('Typed');
  });
});

describe('a comment on its way', () => {
  it('is kept until it lands', () => {
    const send = startSend('MOB-1', 'Looks good', 0);
    expect(sends().map(([, draft]) => draft.text)).toEqual(['Looks good']);
    endSend(send, true);
    expect(sends()).toEqual([]);
    expect(keptComment('MOB-1')).toBeUndefined();
  });

  it('comes back in the box when it fails, once', () => {
    const send = startSend('MOB-1', 'Looks good', 0);
    endSend(send, false);
    endSend(send, false);
    expect(sends()).toEqual([]);
    expect(keptComment('MOB-1')).toBe('Looks good');
  });
});

describe('a comment a killed page left on its way', () => {
  const left = (base: string) => {
    keepDraft(
      'comment-send:k1',
      { ticketKey: 'MOB-1', field: 'comment-send', activityId: 'k1', text: 'LGTM' },
      base,
    );
    const draft = storedDraft('comment-send:k1');
    if (!draft) throw new Error('not kept');
    return draft;
  };

  it('landed when the ticket has more comments with its text than when it was sent', () => {
    const detail = makeTicketDetail(undefined, {
      activity: [comment('c1', 'LGTM'), comment('c2', 'LGTM')],
    });
    settleLeftSend('comment-send:k1', left('1'), detail);
    expect(sends()).toEqual([]);
    expect(keptComment('MOB-1')).toBeUndefined();
  });

  it('comes back in the box when the ticket has no more of them', () => {
    const detail = makeTicketDetail(undefined, { activity: [comment('c1', 'LGTM')] });
    settleLeftSend('comment-send:k1', left('1'), detail);
    expect(sends()).toEqual([]);
    expect(keptComment('MOB-1')).toBe('LGTM');
  });
});
