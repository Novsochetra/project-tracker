import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgetSheetDraft,
  keepSheetDraft,
  SHEET_DRAFTS_STORAGE_KEY,
  sheetDraft,
} from './sheetDrafts';
import { DRAFTS_STORAGE_KEY, storedDrafts } from './storedDrafts';

const ID = 'new-ticket:MOB';
const FORM = { title: 'Fix login', description: '', statusId: null, priority: 'high' };

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sheet drafts', () => {
  it('keep the fields a sheet holds, apart from the ticket drafts', () => {
    keepSheetDraft(ID, FORM);
    expect(sheetDraft(ID)).toEqual(FORM);
    expect(JSON.parse(localStorage.getItem(SHEET_DRAFTS_STORAGE_KEY) ?? '')).toEqual({
      [ID]: FORM,
    });
    expect(localStorage.getItem(DRAFTS_STORAGE_KEY)).toBeNull();
    expect(storedDrafts()).toEqual([]);
  });

  it('take the latest fields and are forgotten one by one', () => {
    keepSheetDraft(ID, FORM);
    keepSheetDraft(ID, { ...FORM, title: 'Fix the login' });
    keepSheetDraft('new-ticket:WEB', FORM);
    expect(sheetDraft(ID)).toMatchObject({ title: 'Fix the login' });
    forgetSheetDraft(ID);
    expect(sheetDraft(ID)).toBeUndefined();
    expect(sheetDraft('new-ticket:WEB')).toEqual(FORM);
    forgetSheetDraft('new-ticket:WEB');
    expect(localStorage.getItem(SHEET_DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it('skip what they cannot read', () => {
    localStorage.setItem(SHEET_DRAFTS_STORAGE_KEY, JSON.stringify({ [ID]: 'text', other: FORM }));
    expect(sheetDraft(ID)).toBeUndefined();
    expect(sheetDraft('other')).toEqual(FORM);
    localStorage.setItem(SHEET_DRAFTS_STORAGE_KEY, 'not json');
    expect(sheetDraft('other')).toBeUndefined();
  });

  it('stay in memory for this visit when storage refuses writes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    // A fresh copy, so the switch to memory doesn't carry over to other tests.
    vi.resetModules();
    const store = await import('./sheetDrafts');
    store.keepSheetDraft(ID, FORM);
    expect(store.sheetDraft(ID)).toEqual(FORM);
  });
});
