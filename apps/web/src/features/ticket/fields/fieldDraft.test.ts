import { describe, expect, it } from 'vitest';
import {
  beginSave,
  checkedDraft,
  editDraft,
  endSave,
  keepMine,
  restoreDraft,
  startDraft,
  syncDraft,
} from './fieldDraft';

describe('field drafts', () => {
  it('start from the server value', () => {
    expect(startDraft('Fix login')).toEqual({
      value: 'Fix login',
      edited: false,
      failed: false,
      saving: 0,
      conflict: false,
    });
  });

  it('follow server changes while the field is not focused', () => {
    expect(syncDraft(startDraft('Fix login'), 'Fix sign-in', false).value).toBe('Fix sign-in');
  });

  it('keep what is typed while focused, whatever the server says', () => {
    const typing = editDraft(startDraft('Fix login'), 'Fix the login');
    expect(syncDraft(typing, 'Agent title', true).value).toBe('Fix the login');
  });

  it('do not flash back to an older save when the field is left before the last save lands', () => {
    let draft = beginSave(editDraft(startDraft('Fix login'), 'Fix the'));
    draft = syncDraft(draft, 'Fix the', true);
    draft = beginSave(editDraft(draft, 'Fix the login error'));
    draft = endSave(draft, 'Fix the', true);
    draft = syncDraft(draft, 'Fix the', false);
    expect(draft.value).toBe('Fix the login error');
    draft = endSave(draft, 'Fix the login error', true);
    draft = syncDraft(draft, 'Fix the login error', false);
    expect(draft).toEqual(startDraft('Fix the login error'));
  });

  // This used to roll back to the server value, which threw away what was typed whenever the
  // tracker couldn't be reached. The text now stays, marked as failed, until a retry saves it.
  it('keep the typed value when a save fails after the field is left, until a retry saves it', () => {
    let draft = beginSave(editDraft(startDraft('Fix login'), 'Fix the login'));
    draft = syncDraft(draft, 'Fix the login', false);
    draft = endSave(draft, 'Fix the login', false);
    draft = syncDraft(draft, 'Fix login', false);
    expect(draft).toEqual({
      value: 'Fix the login',
      edited: true,
      failed: true,
      saving: 0,
      conflict: false,
    });

    draft = beginSave(draft);
    draft = syncDraft(draft, 'Fix the login', false);
    draft = endSave(draft, 'Fix the login', true);
    draft = syncDraft(draft, 'Fix the login', false);
    expect(draft).toEqual(startDraft('Fix the login'));
  });

  it('keep the text when the rollback lands before the failure is reported', () => {
    let draft = beginSave(editDraft(startDraft('Fix login'), 'Fix the login'));
    draft = syncDraft(draft, 'Fix login', false);
    expect(draft.value).toBe('Fix the login');
    draft = endSave(draft, 'Fix the login', false);
    expect(draft.failed).toBe(true);
  });

  it('wait for every save in flight, since an earlier one may still fail', () => {
    let draft = beginSave(beginSave(editDraft(startDraft(''), 'Dara')));
    draft = endSave(draft, 'Dara', true);
    draft = syncDraft(draft, 'Dara', false);
    expect(draft.edited).toBe(true);
    draft = endSave(draft, 'Dara', false);
    draft = syncDraft(draft, '', false);
    expect(draft).toMatchObject({ value: 'Dara', failed: true });
  });

  it('ignore the outcome of a save for text that has been typed over since', () => {
    let draft = beginSave(editDraft(startDraft('Fix login'), 'Fix'));
    draft = editDraft(draft, 'Fix it');
    draft = endSave(draft, 'Fix', false);
    expect(draft).toMatchObject({ value: 'Fix it', failed: false, saving: 0 });
  });

  it('catch up when left untouched after a server change during focus', () => {
    let draft = syncDraft(startDraft('Fix login'), 'Renamed by Claude', true);
    expect(draft.value).toBe('Fix login');
    draft = syncDraft(draft, 'Renamed by Claude', false);
    expect(draft.value).toBe('Renamed by Claude');
  });

  it('return the same draft when nothing changed, so renders settle', () => {
    const draft = startDraft('Fix login');
    expect(syncDraft(draft, 'Fix login', false)).toBe(draft);
    expect(syncDraft(draft, 'Fix login', true)).toBe(draft);
    const typed = editDraft(draft, 'Fix');
    expect(editDraft(typed, 'Fix')).toBe(typed);
  });
});

describe('field drafts kept from an earlier visit', () => {
  it('reopen unsaved and hold their text against the server', () => {
    const draft = restoreDraft('Fix the login');
    expect(draft).toMatchObject({ value: 'Fix the login', edited: true, failed: true });
    expect(syncDraft(draft, 'Fix login', false)).toBe(draft);
  });

  it('follow the server once a check finds the text already saved', () => {
    let draft = checkedDraft(restoreDraft('Fix the login'), 'Fix the login', 'saved');
    draft = syncDraft(draft, 'Fix the login', false);
    expect(draft).toEqual(startDraft('Fix the login'));
  });

  it('wait for the user when the server changed meanwhile, until they keep their text', () => {
    let draft = checkedDraft(restoreDraft('Mine'), 'Mine', 'changed');
    expect(draft).toMatchObject({ value: 'Mine', failed: true, conflict: true });
    expect(syncDraft(draft, 'Theirs', false).value).toBe('Mine');
    draft = beginSave(keepMine(draft));
    expect(draft.conflict).toBe(false);
    draft = syncDraft(endSave(draft, 'Mine', true), 'Mine', false);
    expect(draft).toEqual(startDraft('Mine'));
  });

  it('ignore a check for text that has been typed over since', () => {
    const draft = editDraft(restoreDraft('Mine'), 'Mine, longer');
    expect(checkedDraft(draft, 'Mine', 'changed')).toBe(draft);
  });
});
