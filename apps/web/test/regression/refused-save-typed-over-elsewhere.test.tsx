import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'title:MOB-1';
const STALE = new ApiError(409, 'stale', 'The ticket changed since this edit was typed.');

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Tab B: the same modules with memory of their own, as in another tab.
async function otherTab() {
  vi.resetModules();
  return import('../../src/lib/storedDrafts');
}

function heard() {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
}

// This tab's save hangs; reads answer with what the tracker has.
function trackerWithHangingSave() {
  let title = 'Ticket 1';
  const sending = deferred<never>();
  const client = {
    getTicket: vi.fn(() =>
      Promise.resolve(makeTicketDetail(listItem(1, STATUS.todo, 0, { title }))),
    ),
    updateTicket: vi.fn().mockReturnValueOnce(sending.promise),
  };
  const rendered = renderTicket({ client });
  cleanups.push(rendered.restorePhone);
  return {
    client,
    saveElsewhere: (text: string) => (title = text),
    refuse: () =>
      act(async () => {
        sending.reject(STALE);
        await sending.promise.catch(() => undefined);
      }),
  };
}

// Reviewer 77 (PT-90): tab A's save hung past a minute; tab B typed on top of A's text and, once
// A's mark ran out, saved it. When A's save then landed, the tracker rightly refused it, but A
// kept its older text again in the shared store. Both tabs then showed A's text with "changed
// elsewhere", and Save mine would have put it over B's.
it('follows the tracker when another tab saved newer text typed over its refused one', async () => {
  const user = userEvent.setup();
  const tracker = trackerWithHangingSave();
  const title = screen.getByLabelText('Title');
  await user.type(title, ' from A');
  await user.click(screen.getByLabelText('Description'));
  await waitFor(() => expect(tracker.client.updateTicket).toHaveBeenCalledTimes(1));

  const tabB = await otherTab();
  tabB.keepDraft(
    ID,
    { ticketKey: 'MOB-1', field: 'title', text: 'Ticket 1 from A and B' },
    'Ticket 1',
  );
  heard();
  tracker.saveElsewhere('Ticket 1 from A and B');
  tabB.draftSaved(ID, 'Ticket 1 from A and B');
  heard();

  await tracker.refuse();
  await waitFor(() => expect(tracker.client.getTicket).toHaveBeenCalled());
  // Time for a retry to check and save, if it were going to.
  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(title).toHaveValue('Ticket 1 from A and B');
  expect(screen.queryByText(/isn't saved yet|changed elsewhere/)).not.toBeInTheDocument();
  expect(storedDraft(ID)).toBeUndefined();
  expect(tracker.client.updateTicket).toHaveBeenCalledTimes(1);
});
