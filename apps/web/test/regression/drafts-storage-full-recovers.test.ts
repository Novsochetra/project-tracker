import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const TITLE = { ticketKey: 'MOB-1', field: 'title' } as const;
const OTHER = { ticketKey: 'MOB-2', field: 'title' } as const;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A page of its own: a reload takes the page's memory with it, and the store reads storage again.
async function openPage() {
  vi.resetModules();
  return {
    drafts: await import('../../src/lib/storedDrafts'),
    notes: await import('../../src/lib/draftStorage'),
  };
}

const refuseWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });

// Reviewer 99 (PT-111): text typed while storage was full stayed in the page's memory for good,
// though storage had room again by the time another field was typed in: a reload lost it. Before
// the records, the store wrote what it held in memory again with every later write.
it('stores text kept in memory while storage was full at the next write that fits', async () => {
  const { drafts } = await openPage();
  const full = refuseWrites();
  drafts.keepDraft('title:MOB-1', { ...TITLE, text: 'Fix the login' }, 'Ticket 1');
  expect(drafts.storedDraft('title:MOB-1')?.text).toBe('Fix the login');
  full.mockRestore();
  drafts.keepDraft('title:MOB-2', { ...OTHER, text: 'Other' }, 'Ticket 2');

  const reloaded = await openPage();
  expect(reloaded.drafts.storedDraft('title:MOB-2')?.text).toBe('Other');
  expect(reloaded.drafts.storedDraft('title:MOB-1')?.text).toBe('Fix the login');
});

type Drafts = Awaited<ReturnType<typeof openPage>>['drafts'];

// Reviewer 99 (PT-111, again): room also comes back when a draft goes, such as when another
// field's save lands. Text that is never saved, like the comment box's, then stayed in memory
// until the next write, and a reload before one lost it.
it.each([
  ['its save landing', (drafts: Drafts) => drafts.draftSaved('title:MOB-2', 'Other')],
  ['its text let go', (drafts: Drafts) => drafts.forgetDraft('title:MOB-2')],
  ['its ticket deleted', (drafts: Drafts) => drafts.forgetTicketDrafts('MOB-2')],
])('stores text kept in memory once another draft goes, by %s', async (_how, letGo) => {
  const { drafts } = await openPage();
  drafts.keepDraft('title:MOB-2', { ...OTHER, text: 'Other' }, 'Ticket 2');
  const full = refuseWrites();
  drafts.keepDraft('title:MOB-1', { ...TITLE, text: 'Fix the login' }, 'Ticket 1');
  full.mockRestore();
  letGo(drafts);

  const reloaded = await openPage();
  expect(reloaded.drafts.storedDraft('title:MOB-2')).toBeUndefined();
  expect(reloaded.drafts.storedDraft('title:MOB-1')?.text).toBe('Fix the login');
});

it('stores text kept in memory once another tab lets a draft go', async () => {
  const { drafts } = await openPage();
  drafts.keepDraft('title:MOB-2', { ...OTHER, text: 'Other' }, 'Ticket 2');
  const full = refuseWrites();
  drafts.keepDraft('title:MOB-1', { ...TITLE, text: 'Fix the login' }, 'Ticket 1');
  full.mockRestore();
  const otherTab = await openPage();
  otherTab.drafts.draftSaved('title:MOB-2', 'Other');
  window.dispatchEvent(new StorageEvent('storage', { key: 'tracker.drafts:other-tab:0' }));

  const reloaded = await openPage();
  expect(reloaded.drafts.storedDraft('title:MOB-1')?.text).toBe('Fix the login');
});

// The map of versions before PT-111 frees room too when an entry of it goes.
it('stores text kept in memory once an entry of the earlier map goes', async () => {
  const entry = { ...OTHER, base: 'Ticket 2', text: 'Other' };
  localStorage.setItem('tracker.drafts', JSON.stringify({ 'title:MOB-2': entry }));
  const { drafts } = await openPage();
  const full = refuseWrites();
  drafts.keepDraft('title:MOB-1', { ...TITLE, text: 'Fix the login' }, 'Ticket 1');
  full.mockRestore();
  drafts.draftSaved('title:MOB-2', 'Other');

  const reloaded = await openPage();
  expect(reloaded.drafts.storedDraft('title:MOB-1')?.text).toBe('Fix the login');
});

// §1.6: the "can't be kept" toast shows each time storage starts refusing.
it('says so again when storage starts refusing a second time, after it had room', async () => {
  const { drafts, notes } = await openPage();
  let told = 0;
  notes.onDraftsNotKept(() => (told += 1));
  const full = refuseWrites();
  drafts.keepDraft('title:MOB-1', { ...TITLE, text: 'Fix the login' }, 'Ticket 1');
  expect(told).toBe(1);
  full.mockRestore();
  drafts.keepDraft('title:MOB-2', { ...OTHER, text: 'Other' }, 'Ticket 2');

  refuseWrites();
  drafts.keepDraft('title:MOB-2', { ...OTHER, text: 'Other text' }, 'Ticket 2');
  expect(told).toBe(2);
});
