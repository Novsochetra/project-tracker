import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const STALE = new ApiError(409, 'stale', 'The ticket changed since this edit was typed.');

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Reads hang until the save; by then someone else renamed the ticket, so the save is refused.
function renameWhileSaving() {
  let renamed = false;
  const theirs: TicketDetail = makeTicketDetail(
    listItem(1, STATUS.todo, 0, { title: 'Renamed by Claude' }),
  );
  const client = {
    getTicket: vi.fn(() => (renamed ? Promise.resolve(theirs) : new Promise<never>(() => {}))),
    updateTicket: vi.fn(() => {
      renamed = true;
      return Promise.reject(STALE);
    }),
  };
  const rendered = renderTicket({ client });
  cleanups.push(rendered.restorePhone);
  return client;
}

// Reviewer 61 (PT-76): an older save that landed late overwrote newer text, because a save never
// said what it was typed over. Now it does, and a save the tracker refuses for that is checked
// like a retry at once: here someone else's change, so the field asks which text to keep.
it('says what a save was typed over, and checks a refused one like a retry', async () => {
  const user = userEvent.setup();
  const client = renameWhileSaving();
  const title = screen.getByLabelText('Title');
  await user.type(title, ' fixed');
  await user.click(screen.getByLabelText('Description'));

  await waitFor(() =>
    expect(client.updateTicket).toHaveBeenCalledWith(
      'MOB-1',
      { title: 'Ticket 1 fixed' },
      { title: 'Ticket 1' },
    ),
  );
  expect(
    await screen.findByText("Title changed elsewhere while yours wasn't saved."),
  ).toBeInTheDocument();
  expect(title).toHaveValue('Ticket 1 fixed');
  expect(storedDraft('title:MOB-1')).toMatchObject({ text: 'Ticket 1 fixed', base: 'Ticket 1' });
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(screen.queryByText(STALE.message)).not.toBeInTheDocument();
});
