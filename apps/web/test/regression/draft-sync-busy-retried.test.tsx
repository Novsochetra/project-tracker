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
const TOO_MANY = new ApiError(429, 'rate_limited', 'Too many requests');
const TOO_SLOW = new ApiError(408, 'timeout', 'Request timeout');

function renderDrafts() {
  const client = {
    getTicket: vi.fn().mockResolvedValue(makeTicketDetail(listItem(2, STATUS.todo, 0))),
    updateTicket: vi
      .fn()
      .mockRejectedValueOnce(TOO_MANY)
      .mockRejectedValueOnce(TOO_SLOW)
      .mockResolvedValue(listItem(2, STATUS.todo, 0, { description: 'Fix the login' })),
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

// Reviewer 48 (PT-46): a 429 (too many requests) or a 408 (too slow) counted as the tracker
// refusing the text, so later runs in that page never sent it again, though it would be saved.
it('sends a draft again after a 429 or a 408, as after no answer', async () => {
  keepDraft(ID, { ticketKey: 'MOB-2', field: 'description', text: 'Fix the login' }, '');
  const client = renderDrafts();
  await waitFor(() => expect(client.updateTicket).toHaveBeenCalledTimes(1));
  await runAgain(client);
  expect(client.updateTicket).toHaveBeenCalledTimes(2);
  await runAgain(client);
  expect(client.updateTicket).toHaveBeenCalledTimes(3);
  await waitFor(() => expect(storedDraft(ID)).toBeUndefined());
});
