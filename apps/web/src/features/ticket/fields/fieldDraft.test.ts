import { describe, expect, it } from 'vitest';
import {
  checkedDraft,
  editDraft,
  endSave,
  keepMine,
  markSaved,
  restoreDraft,
  startDraft,
  syncDraft,
  type FieldContext,
} from './fieldDraft';

const IDLE: FieldContext = { focused: false, saving: false, kept: undefined };
const FOCUSED: FieldContext = { ...IDLE, focused: true };
const SAVING: FieldContext = { ...IDLE, saving: true };

describe('field drafts', () => {
  it('start from the server value', () => {
    expect(startDraft('Fix login')).toEqual({
      value: 'Fix login',
      edited: false,
      failed: false,
      carried: false,
      conflict: false,
    });
  });

  it('follow server changes while the field is not focused', () => {
    expect(syncDraft(startDraft('Fix login'), 'Fix sign-in', IDLE).value).toBe('Fix sign-in');
  });

  it('keep what is typed while focused, whatever the server says', () => {
    const typing = editDraft(startDraft('Fix login'), 'Fix the login');
    expect(syncDraft(typing, 'Agent title', FOCUSED).value).toBe('Fix the login');
  });

  it('do not flash back to an older save when the field is left before the last save lands', () => {
    let draft = editDraft(startDraft('Fix login'), 'Fix the');
    draft = editDraft(draft, 'Fix the login error');
    draft = endSave(draft, 'Fix the', true);
    draft = syncDraft(draft, 'Fix the', SAVING);
    expect(draft.value).toBe('Fix the login error');
    draft = endSave(draft, 'Fix the login error', true);
    draft = syncDraft(draft, 'Fix the login error', IDLE);
    expect(draft).toEqual(startDraft('Fix the login error'));
  });

  // This used to roll back to the server value, which threw away what was typed whenever the
  // tracker couldn't be reached. The text now stays, marked as failed, until a retry saves it.
  it('keep the typed value when a save fails after the field is left, until a retry saves it', () => {
    let draft = editDraft(startDraft('Fix login'), 'Fix the login');
    draft = syncDraft(draft, 'Fix the login', { ...SAVING, kept: 'Fix the login' });
    draft = endSave(draft, 'Fix the login', false);
    draft = syncDraft(draft, 'Fix login', { ...IDLE, kept: 'Fix the login' });
    expect(draft).toEqual({
      value: 'Fix the login',
      edited: true,
      failed: true,
      carried: false,
      conflict: false,
    });

    draft = syncDraft(draft, 'Fix the login', { ...SAVING, kept: 'Fix the login' });
    draft = endSave(draft, 'Fix the login', true);
    draft = syncDraft(draft, 'Fix the login', IDLE);
    expect(draft).toEqual(startDraft('Fix the login'));
  });

  it('keep the text when the rollback lands before the failure is reported', () => {
    let draft = editDraft(startDraft('Fix login'), 'Fix the login');
    draft = syncDraft(draft, 'Fix login', SAVING);
    expect(draft.value).toBe('Fix the login');
    draft = endSave(draft, 'Fix the login', false);
    expect(draft.failed).toBe(true);
  });

  it('wait for every save in flight, since an earlier one may still fail', () => {
    let draft = editDraft(startDraft(''), 'Dara');
    draft = endSave(draft, 'Dara', true);
    draft = syncDraft(draft, 'Dara', SAVING);
    expect(draft.edited).toBe(true);
    draft = endSave(draft, 'Dara', false);
    draft = syncDraft(draft, '', { ...IDLE, kept: 'Dara' });
    expect(draft).toMatchObject({ value: 'Dara', failed: true });
  });

  it('ignore the outcome of a save for text that has been typed over since', () => {
    let draft = editDraft(startDraft('Fix login'), 'Fix');
    draft = editDraft(draft, 'Fix it');
    draft = endSave(draft, 'Fix', false);
    expect(draft).toMatchObject({ value: 'Fix it', failed: false });
  });

  it('count as saved when the tracker already has the text', () => {
    const draft = markSaved(editDraft(restoreDraft('Fix login', false), 'Fix'), 'Fix');
    expect(draft).toMatchObject({ value: 'Fix', failed: false });
    expect(syncDraft(draft, 'Fix', IDLE)).toEqual(startDraft('Fix'));
  });

  it('catch up when left untouched after a server change during focus', () => {
    let draft = syncDraft(startDraft('Fix login'), 'Renamed by Claude', FOCUSED);
    expect(draft.value).toBe('Fix login');
    draft = syncDraft(draft, 'Renamed by Claude', IDLE);
    expect(draft.value).toBe('Renamed by Claude');
  });

  it('return the same draft when nothing changed, so renders settle', () => {
    const draft = startDraft('Fix login');
    expect(syncDraft(draft, 'Fix login', IDLE)).toBe(draft);
    expect(syncDraft(draft, 'Fix login', FOCUSED)).toBe(draft);
    const typed = editDraft(draft, 'Fix');
    expect(editDraft(typed, 'Fix')).toBe(typed);
    const failed = restoreDraft('Fix', false);
    expect(syncDraft(failed, 'Fix login', { ...IDLE, kept: 'Fix' })).toBe(failed);
  });
});

describe('field drafts kept from an earlier visit', () => {
  it('reopen unsaved and hold their text against the server', () => {
    const draft = restoreDraft('Fix the login', false);
    expect(draft).toMatchObject({ value: 'Fix the login', edited: true, failed: true });
    expect(syncDraft(draft, 'Fix login', { ...IDLE, kept: 'Fix the login' })).toBe(draft);
  });

  it('follow the server once a check finds the text already saved', () => {
    let draft = checkedDraft(restoreDraft('Fix the login', false), 'Fix the login', 'saved');
    draft = syncDraft(draft, 'Fix the login', IDLE);
    expect(draft).toEqual(startDraft('Fix the login'));
  });

  it('wait for the user when the server changed meanwhile, until they keep their text', () => {
    let draft = checkedDraft(restoreDraft('Mine', false), 'Mine', 'changed');
    expect(draft).toMatchObject({ value: 'Mine', failed: true, conflict: true });
    expect(syncDraft(draft, 'Theirs', { ...IDLE, kept: 'Mine' }).value).toBe('Mine');
    draft = keepMine(draft);
    expect(draft.conflict).toBe(false);
    draft = syncDraft(endSave(draft, 'Mine', true), 'Mine', IDLE);
    expect(draft).toEqual(startDraft('Mine'));
  });

  it('ignore a check for text that has been typed over since', () => {
    const draft = editDraft(restoreDraft('Mine', false), 'Mine, longer');
    expect(checkedDraft(draft, 'Mine', 'changed')).toBe(draft);
  });

  // Text the drafts store no longer keeps was saved elsewhere, such as by the field shown before
  // this one, or dropped there; nothing is left for a retry to send.
  it('follow the server once nothing is kept for them', () => {
    const conflict = checkedDraft(restoreDraft('Mine', false), 'Mine', 'changed');
    expect(syncDraft(conflict, 'Theirs', IDLE)).toEqual(startDraft('Theirs'));
    expect(syncDraft(restoreDraft('Mine', false), 'Mine', IDLE)).toEqual(startDraft('Mine'));
  });
});

describe('field drafts opened while the latest save of their text is on its way', () => {
  it('show the text without a note and hold it until the saves settle', () => {
    const draft = restoreDraft('Fix login now please', true);
    expect(draft).toMatchObject({ value: 'Fix login now please', edited: true, failed: false });
    const kept = 'Fix login now please';
    expect(syncDraft(draft, 'Fix login now', { ...SAVING, kept })).toBe(draft);
  });

  it('follow the server once that save landed and the store let the text go', () => {
    const draft = syncDraft(restoreDraft('Fix login now', true), 'Fix login now', IDLE);
    expect(draft).toEqual(startDraft('Fix login now'));
  });

  it('turn failed when that save failed and the store still keeps the text', () => {
    const kept = 'Fix login now';
    const draft = syncDraft(restoreDraft(kept, true), 'Fix login now please', { ...IDLE, kept });
    expect(draft).toMatchObject({ value: kept, failed: true, carried: false });
  });

  it('settle by their own saves once typed over', () => {
    let draft = editDraft(restoreDraft('Fix login now', true), 'Fix login now!');
    expect(draft.carried).toBe(false);
    draft = endSave(draft, 'Fix login now!', true);
    expect(syncDraft(draft, 'Fix login now!', IDLE)).toEqual(startDraft('Fix login now!'));
  });
});

describe('field drafts whose text another tab typed', () => {
  const kept = 'Fix login from the other tab';

  it('show that text, unsaved, also while focused', () => {
    const draft = startDraft('Fix login');
    expect(syncDraft(draft, 'Fix login', { ...IDLE, kept })).toEqual(restoreDraft(kept, false));
    expect(syncDraft(draft, 'Fix login', { ...FOCUSED, kept }).value).toBe(kept);
    const typed = editDraft(draft, 'Fix login here');
    expect(syncDraft(typed, 'Fix login', { ...FOCUSED, kept }).value).toBe(kept);
  });

  it('wait while a save of the field is on its way', () => {
    const draft = editDraft(startDraft('Fix login'), 'Fix login here');
    expect(syncDraft(draft, 'Fix login', { ...SAVING, kept })).toBe(draft);
  });

  it('show it without a note while that tab sends it, until that save settles', () => {
    const elsewhere = { ...IDLE, sentElsewhere: true, kept };
    const shown = syncDraft(restoreDraft('Fix login from', false), 'Fix login', elsewhere);
    expect(shown).toEqual(restoreDraft(kept, true));
    expect(syncDraft(shown, 'Fix login', elsewhere)).toBe(shown);
    expect(syncDraft(restoreDraft(kept, false), 'Fix login', elsewhere)).toEqual(shown);
    expect(syncDraft(shown, kept, IDLE)).toEqual(startDraft(kept));
    expect(syncDraft(shown, 'Fix login', { ...IDLE, kept })).toMatchObject({ failed: true });
  });

  it('keep a conflict and their own unsent text while another tab sends', () => {
    const conflict = checkedDraft(restoreDraft(kept, false), kept, 'changed');
    const elsewhere = { ...IDLE, sentElsewhere: true, kept };
    expect(syncDraft(conflict, 'Theirs', elsewhere)).toBe(conflict);
    const typed = editDraft(startDraft('Fix login'), kept);
    expect(syncDraft(typed, 'Fix login', elsewhere)).toBe(typed);
  });

  it('follow the server once the other tab saved it', () => {
    const draft = syncDraft(startDraft('Fix login'), 'Fix login', { ...IDLE, kept });
    expect(syncDraft(draft, kept, IDLE)).toEqual(startDraft(kept));
  });

  it('keep the text that tab saved while this tab still has the older copy, until it changes', () => {
    const landed = syncDraft(restoreDraft(kept, true), 'Fix login', IDLE);
    expect(landed).toMatchObject({ value: kept, edited: false, failed: false, carried: false });
    expect(syncDraft(landed, 'Fix login', IDLE)).toBe(landed);
    expect(syncDraft(landed, kept, IDLE)).toEqual(startDraft(kept));
    expect(syncDraft(landed, 'Renamed by Claude', IDLE)).toEqual(startDraft('Renamed by Claude'));
    const typed = editDraft(landed, `${kept}!`);
    expect(syncDraft(typed, 'Fix login', FOCUSED).value).toBe(`${kept}!`);
  });
});
