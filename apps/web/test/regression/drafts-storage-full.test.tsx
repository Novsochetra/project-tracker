import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft } from '../../src/lib/storedDrafts';

const TITLE = { ticketKey: 'MOB-1', field: 'title' } as const;
const ID = 'title:MOB-1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Storage that is full refuses any write that would make it hold more than it does now.
function fillStorage() {
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (value.length > (this.getItem(key)?.length ?? 0)) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    setItem.call(this, key, value);
  });
}

// A page of its own: a reload takes the page's memory with it, and the stores read storage again.
async function openPage() {
  vi.resetModules();
  return {
    drafts: await import('../../src/lib/storedDrafts'),
    sheets: await import('../../src/lib/sheetDrafts'),
  };
}

// Seen with localStorage full: writing tracker.drafts failed, the text stayed in memory only, and
// the copy from before stayed in storage. After a reload the old title came back marked "changed
// elsewhere", and Save mine would have put it over the newer text the tracker had.
it('never brings back older text than the page last had after a reload', async () => {
  const { drafts, sheets } = await openPage();
  drafts.keepDraft(ID, { ...TITLE, text: 'Fix' }, 'Ticket 1');
  drafts.keepDraft('title:MOB-2', { ticketKey: 'MOB-2', field: 'title', text: 'Same' }, 'Ticket 2');
  sheets.keepSheetDraft('new-ticket:MOB', { title: 'Fix' });
  fillStorage();
  drafts.keepDraft(ID, { ...TITLE, text: 'Fix the login' }, 'Fix');
  sheets.keepSheetDraft('new-ticket:MOB', { title: 'Fix the login' });
  expect(drafts.storedDraft(ID)?.text).toBe('Fix the login');
  expect(sheets.sheetDraft('new-ticket:MOB')).toEqual({ title: 'Fix the login' });

  const reloaded = await openPage();
  expect(reloaded.drafts.storedDraft(ID)).toBeUndefined();
  expect(reloaded.drafts.storedDraft('title:MOB-2')?.text).toBe('Same');
  expect(reloaded.sheets.sheetDraft('new-ticket:MOB')).toBeUndefined();
});

it('says so when typed text can only be kept while the page stays open', async () => {
  const api = setupApi();
  function Drafts() {
    useTicketDrafts(true);
    return null;
  }
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  fillStorage();
  act(() => keepDraft(ID, { ...TITLE, text: 'Fix the login' }, 'Ticket 1'));
  expect(
    await screen.findByText(
      "Unsaved text can't be kept on this device, so it's lost if this page closes.",
    ),
  ).toBeInTheDocument();
});
