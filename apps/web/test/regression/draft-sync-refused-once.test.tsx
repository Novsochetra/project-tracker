import { act, render, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft, storedDraft } from '../../src/lib/storedDrafts';

function Drafts() {
  useTicketDrafts(true);
  return null;
}

const ID = 'description:MOB-2';
const REFUSED = new ApiError(400, 'invalid_input', 'description: Too big');

const keep = (text: string) =>
  keepDraft(ID, { ticketKey: 'MOB-2', field: 'description', text }, '');

function renderDrafts() {
  const client = {
    getTicket: vi.fn().mockResolvedValue(makeTicketDetail(listItem(2, STATUS.todo, 0))),
    updateTicket: vi.fn().mockRejectedValue(REFUSED),
  };
  const api = setupApi(client);
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  return client;
}

// Each run reads the ticket first; once its draft is through, the run is.
async function runAgain(client: ReturnType<typeof renderDrafts>) {
  const reads = client.getTicket.mock.calls.length;
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  await waitFor(() => expect(client.getTicket).toHaveBeenCalledTimes(reads + 1));
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A description the tracker refuses (400) in a ticket that isn't open was sent again at every
// run: every start, reconnect and, while it waited, every reported change, 10 s apart.
it('sends a refused draft once, and again only once its text changed', async () => {
  keep('Far too much text');
  const client = renderDrafts();
  await waitFor(() => expect(client.updateTicket).toHaveBeenCalledTimes(1));
  await runAgain(client);
  await runAgain(client);
  expect(client.updateTicket).toHaveBeenCalledTimes(1);
  expect(storedDraft(ID)?.text).toBe('Far too much text');

  keep('Less text');
  await runAgain(client);
  expect(client.updateTicket).toHaveBeenCalledTimes(2);
  expect(client.updateTicket).toHaveBeenLastCalledWith(
    'MOB-2',
    { description: 'Less text' },
    { description: '' },
  );
});
