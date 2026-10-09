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
