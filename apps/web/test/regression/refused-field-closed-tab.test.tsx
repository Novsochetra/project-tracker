import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { SAVE_MARKS_STORAGE_KEY } from '../../src/features/ticket/fields/saveMarks';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY, keepDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'title:MOB-1';
const NOTE = "Title isn't saved yet.";
const STALE = new ApiError(409, 'stale', 'The ticket changed since this edit was typed.');

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Tab A typed ' from A' and closed while its save was on its way: its kept text and its mark stay,
// and the mark counts until `until`. Its save never reached the tracker.
function tabAClosedMidSave(until: number) {
  keepDraft(ID, { ticketKey: 'MOB-1', field: 'title', text: 'Ticket 1 from A' }, 'Ticket 1');
  const mark = { draft: ID, page: 'closed-tab', until };
  localStorage.setItem(`${SAVE_MARKS_STORAGE_KEY}:closed-tab:${ID}`, JSON.stringify(mark));
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
}

// This tab's save, typed over A's text, is refused while the tracker still has 'Ticket 1'.
function typeOverRefused() {
  const user = userEvent.setup();
  const updateTicket = vi.fn().mockRejectedValueOnce(STALE).mockResolvedValue({});
  const getTicket = vi.fn().mockResolvedValue(makeTicketDetail());
  const rendered = renderTicket({ client: { updateTicket, getTicket } });
  cleanups.push(rendered.restorePhone);
  return { user, updateTicket };
}

async function typeAndLeave(user: ReturnType<typeof userEvent.setup>) {
  const title = screen.getByLabelText('Title');
  await waitFor(() => expect(title).toHaveValue('Ticket 1 from A'));
  await user.type(title, ' and B');
  await user.click(screen.getByLabelText('Description'));
  expect(await screen.findByText(NOTE)).toBeInTheDocument();
}

// Reviewer 77 (PT-90): a refused field waited on a tab that closed mid-save until something else
// happened (Retry, going online), though that tab's mark had run out.
it('checks a refused field by itself once a closed tab’s mark runs out', async () => {
  const tracker = typeOverRefused();
  tabAClosedMidSave(Date.now() + 1_000);
  await typeAndLeave(tracker.user);
  expect(tracker.updateTicket).toHaveBeenCalledTimes(1);

  await waitFor(
    () =>
      expect(tracker.updateTicket).toHaveBeenLastCalledWith(
        'MOB-1',
        { title: 'Ticket 1 from A and B' },
        { title: 'Ticket 1' },
      ),
    { timeout: 3_000 },
  );
  await waitFor(() => expect(screen.queryByText(NOTE)).not.toBeInTheDocument());
});

it('says why Retry waits while another tab is still saving the field', async () => {
  const tracker = typeOverRefused();
  tabAClosedMidSave(Date.now() + 60_000);
  await typeAndLeave(tracker.user);

  await tracker.user.click(screen.getByRole('button', { name: 'Retry saving title' }));
  expect(
    await screen.findByText(
      "Another tab is still saving the title. Yours is tried again once that's done, within a minute.",
    ),
  ).toBeInTheDocument();
  expect(tracker.updateTicket).toHaveBeenCalledTimes(1);
});
