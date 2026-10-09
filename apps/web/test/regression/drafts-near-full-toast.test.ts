import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const TITLE = { ticketKey: 'MOB-1', field: 'title' } as const;
const OTHER = { ticketKey: 'MOB-2', field: 'title' } as const;
const ID = 'title:MOB-1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A page of its own: a reload takes the page's memory with it, and the store reads storage again.
async function openPage() {
  vi.resetModules();
  const page = {
    drafts: await import('../../src/lib/storedDrafts'),
    notes: await import('../../src/lib/draftStorage'),
    told: 0,
  };
  page.notes.onDraftsNotKept(() => (page.told += 1));
  return page;
}

const usedSize = (): number =>
  Object.keys(localStorage).reduce(
    (size, key) => size + key.length + (localStorage.getItem(key)?.length ?? 0),
    0,
  );

// Like a browser's quota: storage refuses a write that would make it hold more than `limit`.
function limitStorage(limit: number) {
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    const replaced = this.getItem(key);
    const freed = replaced === null ? 0 : key.length + replaced.length;
    if (usedSize() - freed + key.length + value.length > limit) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    setItem.call(this, key, value);
  });
}

// Room for 40 more characters: less than one record, more than a few keystrokes.
const ROOM = 40;

// Reviewer 99 (PT-111): with less room than one record, each keystroke's new record was refused
// before the one it outdates had gone, so the "can't be kept" toast showed on 11 of 12 keystrokes,
// though the new record was stored a moment later and nothing was lost.
it("doesn't say text can't be kept when the record it outdates makes room for it", async () => {
  const page = await openPage();
  let text = 'Fix';
  page.drafts.keepDraft(ID, { ...TITLE, text }, 'Ticket 1');
  limitStorage(usedSize() + ROOM);
  for (let typed = 0; typed < 12; typed++) {
    text += 'y';
    page.drafts.keepDraft(ID, { ...TITLE, text }, 'Ticket 1');
  }
  expect(page.told).toBe(0);

  const reloaded = await openPage();
  expect(reloaded.drafts.storedDraft(ID)?.text).toBe(text);
});

// §1.6: told each time storage starts refusing, once for as long as it does.
it('still says so once when the text outgrows that room, and again after it fitted', async () => {
  const page = await openPage();
  page.drafts.keepDraft(ID, { ...TITLE, text: 'Fix' }, 'Ticket 1');
  limitStorage(usedSize() + ROOM);
  const long = `Fix ${'the login '.repeat(8)}`;
  page.drafts.keepDraft(ID, { ...TITLE, text: long }, 'Ticket 1');
  expect(page.told).toBe(1);
  page.drafts.keepDraft(ID, { ...TITLE, text: `${long}now` }, 'Ticket 1');
  expect(page.told).toBe(1);
  expect((await openPage()).drafts.storedDraft(ID)).toBeUndefined();

  page.drafts.keepDraft(ID, { ...TITLE, text: 'Fix it' }, 'Ticket 1');
  expect(page.told).toBe(1);
  page.drafts.keepDraft(ID, { ...TITLE, text: long }, 'Ticket 1');
  expect(page.told).toBe(2);
});

const storageListeners = (spy: { mock: { calls: unknown[][] } }): Set<unknown> =>
  new Set(spy.mock.calls.filter(([type]) => type === 'storage').map(([, listener]) => listener));

// Reviewer 99 (PT-111): the page listened to other tabs' removals for good from its first refused
// record on, so in tests every simulated reload left a listener on the window.
it('stops listening for room made by other tabs once no text waits in memory', async () => {
  const added = vi.spyOn(window, 'addEventListener');
  const removed = vi.spyOn(window, 'removeEventListener');
  const page = await openPage();
  const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
  page.drafts.keepDraft(ID, { ...TITLE, text: 'Fix the login' }, 'Ticket 1');
  expect(storageListeners(added).size).toBe(1);
  full.mockRestore();
  page.drafts.keepDraft('title:MOB-2', { ...OTHER, text: 'Other' }, 'Ticket 2');

  expect(storageListeners(removed)).toEqual(storageListeners(added));
});
