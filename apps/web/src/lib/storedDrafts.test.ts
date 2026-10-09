import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredDrafts,
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

// The same module with memory of its own, as in another tab (or the page after a reload).
async function otherTab() {
  vi.resetModules();
  return import('./storedDrafts');
}

const draftKeys = () =>
  Object.keys(localStorage).filter((key) => key.startsWith(DRAFTS_STORAGE_KEY));

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
  it('keep typed text with the server value it was first typed over', async () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix the' }, 'Fix login');
    const first = storedDraft(TITLE_ID)?.at ?? 0;
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix the login' }, 'Fix the');
    const kept = { ...TITLE, base: 'Fix login', text: 'Fix the login', at: expect.any(Number) };
    expect(storedDraft(TITLE_ID)).toEqual(kept);
    // In storage, one record for the draft, which another tab reads too.
    expect(draftKeys()).toHaveLength(1);
    expect((await otherTab()).storedDraft(TITLE_ID)).toEqual(kept);
    expect(hasStoredDrafts()).toBe(true);
    // Each new text is later than the one before, also within one millisecond; a new base keeps
    // the time the text was typed.
    const typedAt = storedDraft(TITLE_ID)?.at;
    expect(typedAt).toBeGreaterThan(first);
    rebaseDraft(TITLE_ID, 'Fix it');
    expect(storedDraft(TITLE_ID)?.at).toBe(typedAt);
  });

  it('are done once the server has the kept text, and move their base when it has older text', () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix the login' }, 'Fix login');
    draftSaved(TITLE_ID, 'Fix the');
    expect(storedDraft(TITLE_ID)).toMatchObject({ base: 'Fix the', text: 'Fix the login' });
    draftSaved(TITLE_ID, 'Fix the login');
    expect(storedDraft(TITLE_ID)).toBeUndefined();
    expect(hasStoredDrafts()).toBe(false);
    expect(draftKeys()).toEqual([]);
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

  it('are all gone after a clear, also those only in memory', () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'On disk' }, 'Fix login');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    keepDraft('title:MOB-9', { ticketKey: 'MOB-9', field: 'title', text: 'In memory' }, '');
    clearStoredDrafts();
    vi.restoreAllMocks();
    expect(hasStoredDrafts()).toBe(false);
    expect(draftKeys()).toEqual([]);
  });
});

describe('drafts kept in two tabs', () => {
  it('show the text typed last, and the tab that outdates a record removes it', async () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix it' }, 'Fix login');
    const tabB = await otherTab();
    tabB.keepDraft(TITLE_ID, { ...TITLE, text: 'Fix it now' }, 'Fix it');
    expect(storedDraft(TITLE_ID)).toMatchObject({ text: 'Fix it now', base: 'Fix login' });
    expect(draftKeys()).toHaveLength(1);
  });

  it('never let a tab put older text over text another tab kept since', async () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix it' }, 'Fix login');
    const older = storedDraft(TITLE_ID)?.at ?? 0;
    const tabB = await otherTab();
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix it now' }, 'Fix it');
    // Tab B works from a copy that hadn't heard of 'Fix it now': its record is older.
    const records = await import('./tabRecords');
    records.putRecord({ ...TITLE, text: 'Fix it', base: 'Fix login', at: older });
    expect(tabB.storedDraft(TITLE_ID)?.text).toBe('Fix it now');
    expect(storedDraft(TITLE_ID)?.text).toBe('Fix it now');
  });

  it('take a base another tab learned for the text typed last', async () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix it now' }, 'Fix login');
    const typedAt = storedDraft(TITLE_ID)?.at;
    (await otherTab()).rebaseDraft(TITLE_ID, 'Fix it');
    expect(storedDraft(TITLE_ID)).toMatchObject({
      text: 'Fix it now',
      base: 'Fix it',
      at: typedAt,
    });
  });

  it('let a tab end a draft whose text it has read, whichever tab kept it', async () => {
    keepDraft(TITLE_ID, { ...TITLE, text: 'Fix it now' }, 'Fix login');
    (await otherTab()).draftSaved(TITLE_ID, 'Fix it now');
    expect(storedDraft(TITLE_ID)).toBeUndefined();
    expect(draftKeys()).toEqual([]);
  });

  // Tabs of the versions before PT-111 kept every draft in one map, written whole.
  it('read the map of earlier versions as one more tab, and drop an entry newer text outdates', () => {
    const entry = { ...TITLE, base: 'Fix login', text: 'From an older tab' };
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify({ [TITLE_ID]: entry }));
    expect(storedDraft(TITLE_ID)).toMatchObject({ text: 'From an older tab', base: 'Fix login' });
    keepDraft(TITLE_ID, { ...TITLE, text: 'From an older tab, and me' }, 'Fix login');
    expect(storedDraft(TITLE_ID)?.text).toBe('From an older tab, and me');
    expect(localStorage.getItem(DRAFTS_STORAGE_KEY)).toBeNull();
  });
});
