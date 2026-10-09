import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

const NETWORK_DOWN = new TypeError('Failed to fetch');

// The description's autosave is on its way and fails later, like a request on a bad connection.
async function typeWhileSaving() {
  const user = userEvent.setup();
  const server = fakeTicketServer(makeTicketDetail());
  const save = deferred<never>();
  const updateTicket = vi
    .fn()
    .mockReturnValueOnce(save.promise)
    .mockImplementation(server.client.updateTicket);
  const rendered = renderTicket({
    detail: server.detail,
    client: { ...server.client, updateTicket },
  });
  cleanups.push(rendered.restorePhone);
  await user.type(screen.getByLabelText('Description'), 'Steps');
  await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(1));
  await user.click(screen.getByLabelText('Title'));
  const fail = () =>
    act(async () => {
      save.reject(NETWORK_DOWN);
      await Promise.resolve();
    });
  return { user, server, rendered, fail };
}

const kept = () => storedDraft('description:MOB-1');

// Seen in Chromium and WebKit: leaving the field while its autosave was on its way took the
// save's optimistic copy in the cache for the tracker's, so the kept text was dropped (a reload
// didn't ask first). When the save then failed, the text was kept again over itself, and the
// retry said someone else had changed the description.
it('keeps the draft while its save is on its way, and retries it without a false conflict', async () => {
  const { user, server, fail } = await typeWhileSaving();
  expect(kept()).toEqual({
    ticketKey: 'MOB-1',
    field: 'description',
    base: '',
    text: 'Steps',
    at: expect.any(Number),
  });
  expect(hasDrafts()).toBe(true);

  await fail();
  expect(await screen.findByText("Description isn't saved yet.")).toBeInTheDocument();
  expect(kept()?.base).toBe('');
  await user.click(screen.getByRole('button', { name: 'Retry saving description' }));
  await waitFor(() => expect(server.detail.ticket.description).toBe('Steps'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(screen.queryByText(/changed elsewhere/)).not.toBeInTheDocument();
});

it('saves a draft whose save failed after the ticket was left, without a false conflict', async () => {
  const { server, rendered, fail } = await typeWhileSaving();
  rendered.unmount();
  expect(hasDrafts()).toBe(true);
  await fail();
  expect(kept()?.base).toBe('');

  const project = renderTicket({
    detail: server.detail,
    client: server.client,
    children: <p>Project screen</p>,
  });
  cleanups.push(project.restorePhone);
  await waitFor(() => expect(server.detail.ticket.description).toBe('Steps'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(screen.queryByText(/changed elsewhere/)).not.toBeInTheDocument();
});
