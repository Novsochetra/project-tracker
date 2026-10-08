import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UpdateTicketInput } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { storedDrafts } from '../../src/lib/storedDrafts';
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

// Seen in Chromium: the description's and the assignee's saves failed one after the other, and
// the assignee's rollback put the typed description back in the cache. The retry then found the
// description unsaved on the tracker, but the save asked the cache, took it as already saved and
// dropped the text.
it('sends a checked retry even when the cache still shows the typed text', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(makeTicketDetail());
  const saves: Array<Deferred<unknown>> = [];
  const updateTicket = vi.fn((_key: string, _input: UpdateTicketInput): Promise<unknown> => {
    const save = deferred<unknown>();
    saves.push(save);
    return save.promise;
  });
  const rendered = renderTicket({
    detail: server.detail,
    client: { ...server.client, updateTicket },
  });
  cleanups.push(rendered.restorePhone);
  await user.type(screen.getByLabelText('Description'), 'Typed offline.');
  await user.type(screen.getByLabelText('Assignee'), 'Dara');
  await user.tab();
  expect(saves).toHaveLength(2);

  server.setReachable(false);
  await act(async () => {
    saves[0]!.reject(NETWORK_DOWN);
    await Promise.resolve();
    saves[1]!.reject(NETWORK_DOWN);
  });
  expect(await screen.findByText("Description isn't saved yet.")).toBeInTheDocument();
  await waitFor(() => expect(rendered.queryClient.isFetching()).toBe(0));

  server.setReachable(true);
  updateTicket.mockImplementation(server.client.updateTicket);
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  await waitFor(() => expect(server.detail.ticket.description).toBe('Typed offline.'));
  await waitFor(() => expect(storedDrafts()).toEqual([]));
});
