import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { SAVE_MARKS_STORAGE_KEY } from '../../src/features/ticket/fields/saveMarks';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'title:MOB-1';
const TITLE = { ticketKey: 'MOB-1', field: 'title' } as const;

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Tab A: the same modules with memory of their own, as in another tab.
async function otherTab() {
  vi.resetModules();
  return {
    drafts: await import('../../src/lib/storedDrafts'),
    saves: await import('../../src/features/ticket/fields/fieldSaves'),
  };
}

// This tab hears of tab A's writes the way browsers tell other tabs: one event per write.
function heard(...keys: string[]) {
  keys.forEach((key) =>
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    }),
  );
}

// Reviewer 48 (PT-46): two tabs online, reads slow. Once tab A's save landed, tab B's title went
// back to the old text until B's own read landed (6 s), and typing in B then saved over A's text.
it('keeps showing the text another tab saved until its own read lands, and types on top', async () => {
  const user = userEvent.setup();
  const updateTicket = vi.fn().mockResolvedValue(makeTicketDetail().ticket);
  // Reads in this tab never answer here: they are slower than the test.
  const rendered = renderTicket({ client: { updateTicket } });
  cleanups.push(rendered.restorePhone);
  const tabA = await otherTab();
  const title = screen.getByLabelText('Title');

  tabA.drafts.keepDraft(ID, { ...TITLE, text: 'Ticket 1 from A' }, 'Ticket 1');
  const save = tabA.saves.startSave(ID, 'Ticket 1 from A');
  heard(DRAFTS_STORAGE_KEY, SAVE_MARKS_STORAGE_KEY);
  expect(title).toHaveValue('Ticket 1 from A');

  tabA.saves.finishSave(ID, save, true);
  heard(DRAFTS_STORAGE_KEY, SAVE_MARKS_STORAGE_KEY);
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(title).toHaveValue('Ticket 1 from A');
  expect(screen.queryByText(/isn't saved/)).not.toBeInTheDocument();

  await user.type(title, ' and B');
  await user.click(screen.getByLabelText('Description'));
  await waitFor(() => expect(updateTicket).toHaveBeenCalled());
  expect(updateTicket).toHaveBeenLastCalledWith(
    'MOB-1',
    { title: 'Ticket 1 from A and B' },
    { title: 'Ticket 1 from A' },
  );
});
