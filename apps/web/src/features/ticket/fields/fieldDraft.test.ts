import { describe, expect, it } from 'vitest';
import { editDraft, startDraft, syncDraft } from './fieldDraft';

describe('field drafts', () => {
  it('start from the server value', () => {
    expect(startDraft('Fix login')).toEqual({
      value: 'Fix login',
      seen: 'Fix login',
      edited: false,
    });
  });

  it('follow server changes while the field is not focused', () => {
    expect(syncDraft(startDraft('Fix login'), 'Fix sign-in', false).value).toBe('Fix sign-in');
  });

  it('keep what is typed while focused, but note the server change', () => {
    const typing = editDraft(startDraft('Fix login'), 'Fix the login');
    const synced = syncDraft(typing, 'Agent title', true);
    expect(synced.value).toBe('Fix the login');
    expect(synced.seen).toBe('Agent title');
  });

  it('do not flash back to an older save when the field is left before the last save lands', () => {
    let draft = editDraft(startDraft('Fix login'), 'Fix the');
    draft = syncDraft(draft, 'Fix the', true);
    draft = editDraft(draft, 'Fix the login error');
    draft = syncDraft(draft, 'Fix the', false);
    expect(draft.value).toBe('Fix the login error');
    draft = syncDraft(draft, 'Fix the login error', false);
    expect(draft).toEqual(startDraft('Fix the login error'));
  });

  it('roll back to the server value when a save fails after the field is left', () => {
    let draft = editDraft(startDraft('Fix login'), 'Too long');
    draft = syncDraft(draft, 'Too long', false);
    draft = syncDraft(draft, 'Fix login', false);
    expect(draft.value).toBe('Fix login');
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
