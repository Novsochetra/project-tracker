import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'title:MOB-1';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function openTicket() {
  // Saves never answer here, so the typed text stays this tab's unsaved text.
  const updateTicket = vi.fn(() => new Promise<never>(() => {}));
  const rendered = renderTicket({ client: { updateTicket } });
  cleanups.push(rendered.restorePhone);
}

// Another tab writes the drafts store back from a copy that hadn't heard of this tab's latest
// typing: its entry has older text, typed earlier, or none.
function anotherTabWritesBack(entry: { text: string; at: number } | null) {
  act(() => {
    const drafts = entry
      ? { [ID]: { ticketKey: 'MOB-1', field: 'title', base: 'Ticket 1 from A', ...entry } }
      : {};
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
}

// Lead (PT-90 E2E under load, desktop): tab B typed " and B" on top of tab A's title while A's
// save was on its way. A, answering its save from a copy of the store that had only " an" of it,
// wrote that older text back; B took it for text A had typed, showed it, and " d B" was gone.
it('keeps text it typed when another tab writes an older copy back, and keeps it again', async () => {
  const user = userEvent.setup();
  openTicket();
  const title = screen.getByLabelText('Title');
  await user.type(title, ' from A and B');
  const typedAt = storedDraft(ID)?.at ?? 0;

  anotherTabWritesBack({ text: 'Ticket 1 from A an', at: typedAt - 50 });
  expect(title).toHaveValue('Ticket 1 from A and B');
  await waitFor(() => expect(storedDraft(ID)?.text).toBe('Ticket 1 from A and B'));
  expect(storedDraft(ID)?.base).toBe('Ticket 1 from A');

  anotherTabWritesBack(null);
  expect(title).toHaveValue('Ticket 1 from A and B');
  await waitFor(() => expect(storedDraft(ID)?.text).toBe('Ticket 1 from A and B'));
});

it('still shows newer text another tab typed', async () => {
  const user = userEvent.setup();
  openTicket();
  const title = screen.getByLabelText('Title');
  await user.type(title, ' from B');
  const typedAt = storedDraft(ID)?.at ?? 0;

  anotherTabWritesBack({ text: 'Ticket 1 from B, and A', at: typedAt + 50 });
  expect(title).toHaveValue('Ticket 1 from B, and A');
  expect(storedDraft(ID)?.text).toBe('Ticket 1 from B, and A');
});
