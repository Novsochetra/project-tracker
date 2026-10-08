import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { queryKeys } from '../../src/api';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  goOffline,
  goOnline,
  restoreOnLine,
} from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { DRAFTS_STORAGE_KEY, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'title:MOB-1';
const NOTE = "Title isn't saved yet.";

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations(), restoreOnLine];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function openTicket() {
  const server = fakeTicketServer(makeTicketDetail());
  const rendered = renderTicket({ detail: server.detail, client: server.client });
  cleanups.push(rendered.restorePhone);
  return { server, rendered };
}

// Another tab writes the drafts store; this tab hears of it the way browsers tell other tabs.
function anotherTabKeeps(text: string | null) {
  act(() => {
    if (text === null) localStorage.removeItem(DRAFTS_STORAGE_KEY);
    else {
      const draft = { ticketKey: 'MOB-1', field: 'title', base: 'Ticket 1', text };
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify({ [ID]: draft }));
    }
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
}

// Seen with two tabs on one ticket while offline: each tab's title field kept its own text, the
// store only the text typed last. Back online, one tab saved the other tab's text, so its own
// was lost and closing it didn't ask, and the other tab kept an "isn't saved yet" note.
it('shows the text another tab typed in the same field, so this tab types on top of it', async () => {
  const user = userEvent.setup();
  const { server } = openTicket();
  goOffline(server);
  anotherTabKeeps('Ticket 1 from tab A');
  const title = screen.getByLabelText('Title');
  expect(title).toHaveValue('Ticket 1 from tab A');
  expect(screen.getByText(NOTE)).toBeInTheDocument();

  await user.type(title, ' and tab B');
  await user.click(screen.getByLabelText('Description'));
  expect(storedDraft(ID)?.text).toBe('Ticket 1 from tab A and tab B');

  goOnline(server);
  await waitFor(() => expect(server.detail.ticket.title).toBe('Ticket 1 from tab A and tab B'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(title).toHaveValue('Ticket 1 from tab A and tab B');
  expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
});

it('lets go of its note once another tab saved the text', async () => {
  const user = userEvent.setup();
  const { server, rendered } = openTicket();
  goOffline(server);
  const title = screen.getByLabelText('Title');
  await user.type(title, ' now');
  await user.click(screen.getByLabelText('Description'));
  expect(await screen.findByText(NOTE)).toBeInTheDocument();
  // The read after the failed save fails too; then nothing else happens on this screen.
  await waitFor(() => expect(server.client.getTicket).toHaveBeenCalled());
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  // The other tab showed the same text and saved it once it was back online.
  server.edit({ title: 'Ticket 1 now' });
  anotherTabKeeps(null);
  await waitFor(() => expect(screen.queryByText(NOTE)).not.toBeInTheDocument(), {
    timeout: 1000,
  });
  // Its save reaches this tab as a live update.
  server.setReachable(true);
  await act(() => rendered.queryClient.invalidateQueries({ queryKey: queryKeys.ticket('MOB-1') }));
  await waitFor(() => expect(title).toHaveValue('Ticket 1 now'));
  expect(hasDrafts()).toBe(false);
});
