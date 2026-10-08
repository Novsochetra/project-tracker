import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFTS_STORAGE_KEY,
  draftIdOf,
  draftSaved,
  forgetDraft,
  forgetTicketDrafts,
  hasStoredDrafts,
  keepDraft,
  parseDrafts,
  rebaseDraft,
  storedDraft,
  storedDrafts,
  subscribeStoredDrafts,
} from './storedDrafts';

const TITLE = { ticketKey: 'MOB-3', field: 'title' } as const;
const TITLE_ID = 'title:MOB-3';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('draft ids', () => {
  it('name a field by ticket and a comment edit by comment', () => {
    expect(draftIdOf(TITLE)).toBe('title:MOB-3');
    expect(draftIdOf({ ticketKey: 'MOB-3', field: 'comment' })).toBe('comment:MOB-3');
    expect(draftIdOf({ ticketKey: 'MOB-3', field: 'comment-edit', activityId: 'c1' })).toBe(
      'comment-edit:c1',
    );
  });
});

describe('stored drafts', () => {
  it('keep typed text with the server value it was first typed over', () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix the' }, 'Fix login');
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix the login' }, 'Fix the');
    expect(storedDraft(TITLE_ID)).toEqual({ ...TITLE, base: 'Fix login', text: 'Fix the login' });
    expect(JSON.parse(localStorage.getItem(DRAFTS_STORAGE_KEY) ?? '')).toEqual({
      [TITLE_ID]: { ...TITLE, base: 'Fix login', text: 'Fix the login' },
    });
    expect(hasStoredDrafts()).toBe(true);
  });

  it('are done once the server has the kept text, and move their base when it has older text', () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix the login' }, 'Fix login');
    draftSaved(TITLE_ID, 'Fix the');
    expect(storedDraft(TITLE_ID)).toMatchObject({ base: 'Fix the', text: 'Fix the login' });
    draftSaved(TITLE_ID, 'Fix the login');
    expect(storedDraft(TITLE_ID)).toBeUndefined();
    expect(hasStoredDrafts()).toBe(false);
    expect(localStorage.getItem(DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it('take a new base when the user keeps their text over a changed server value', () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Mine' }, 'Old');
    rebaseDraft(TITLE_ID, 'Theirs');
    expect(storedDraft(TITLE_ID)).toMatchObject({ base: 'Theirs', text: 'Mine' });
  });

  it('are forgotten one by one or for a whole ticket', () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Mine' }, '');
    keepDraft('comment:MOB-3', { ticketKey: 'MOB-3', field: 'comment', text: 'Hi' }, '');
    keepDraft('title:MOB-4', { ticketKey: 'MOB-4', field: 'title', text: 'Other' }, '');
    forgetDraft(TITLE_ID);
    expect(storedDrafts().map(([id]) => id)).toEqual(['comment:MOB-3', 'title:MOB-4']);
    forgetTicketDrafts('MOB-3');
    expect(storedDrafts().map(([id]) => id)).toEqual(['title:MOB-4']);
  });

  it('see what another tab stored', () => {
    localStorage.setItem(
      DRAFTS_STORAGE_KEY,
      JSON.stringify({ [TITLE_ID]: { ...TITLE, base: '', text: 'From another tab' } }),
    );
    expect(storedDraft(TITLE_ID)?.text).toBe('From another tab');
  });

  it('skip what they cannot read', () => {
    expect(parseDrafts('not json')).toEqual({});
    expect(parseDrafts('[1]')).toEqual({});
    expect(
      parseDrafts(
        JSON.stringify({
          good: { ...TITLE, base: '', text: 'Fine' },
          noText: { ...TITLE, base: '' },
          oddField: { ...TITLE, field: 'priority', base: '', text: 'x' },
        }),
      ),
    ).toEqual({ good: { ...TITLE, base: '', text: 'Fine' } });
  });
});

describe('changes to the stored drafts', () => {
  const storageEvent = (key: string | null) =>
    window.dispatchEvent(new StorageEvent('storage', { key }));

  it('reach subscribers from this tab, from other tabs and when the tab is shown', () => {
    const listener = vi.fn();
    const stop = subscribeStoredDrafts(listener);
    keepDraft(TITLE_ID, { ...TITLE, text: 'Mine' }, '');
    expect(listener).toHaveBeenCalledTimes(1);
    storageEvent(DRAFTS_STORAGE_KEY);
    storageEvent(null);
    expect(listener).toHaveBeenCalledTimes(3);
    storageEvent('tracker.sheetDrafts');
    expect(listener).toHaveBeenCalledTimes(3);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenCalledTimes(4);
    stop();
    storageEvent(DRAFTS_STORAGE_KEY);
    forgetDraft(TITLE_ID);
    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe('stored drafts without storage', () => {
  it('stay in memory for this visit when storage refuses writes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    // A fresh copy, so the switch to memory doesn't carry over to other tests.
    vi.resetModules();
    const store = await import('./storedDrafts');
    store.keepDraft('title:MOB-9', { ticketKey: 'MOB-9', field: 'title', text: 'Kept' }, '');
    expect(store.storedDraft('title:MOB-9')?.text).toBe('Kept');
    expect(store.hasStoredDrafts()).toBe(true);
  });
});
