import { act, screen, waitFor } from '@testing-library/react';
import type { UpdateTicketInput } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { keepDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Seen after a reload in Chromium: the app-wide sync started while the ticket was still loading,
// took the kept text for text left in a closed ticket and saved it. The field, opening a moment
// later, checked the ticket before that save landed and saved the text again: two fresh reads
// and two identical saves.
it('retries a field draft once when the app starts before its ticket has loaded', async () => {
  keepDraft(
    'description:MOB-1',
    { ticketKey: 'MOB-1', field: 'description', text: 'Steps typed earlier' },
    '',
  );
  const server = fakeTicketServer(makeTicketDetail());
  const firstSave = deferred<void>();
  const updateTicket = vi.fn((key: string, input: UpdateTicketInput) =>
    (updateTicket.mock.calls.length === 1 ? firstSave.promise : Promise.resolve()).then(() =>
      server.client.updateTicket(key, input),
    ),
  );
  const rendered = renderTicket({
    detail: server.detail,
    client: { ...server.client, updateTicket },
    seed: false,
  });
  cleanups.push(rendered.restorePhone);
  await screen.findByDisplayValue('Steps typed earlier');
  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  firstSave.resolve();
  await waitFor(() => expect(server.detail.ticket.description).toBe('Steps typed earlier'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(updateTicket).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Description isn't saved yet.")).not.toBeInTheDocument();
});
