import { act, render } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { RETRY_GAP_MS, useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft, storedDrafts } from '../../src/lib/storedDrafts';

// A bare 5xx made the tracker unreachable at once, and the next answer reachable again, which
// retried the text kept for closed tickets. Since PT-101 the tracker is checked first, and a check
// it answers changed nothing, so a draft whose save got such a 5xx, as one through a proxy whose
// connection broke, waited for the next start, `online` or change in its project (PT-101 review).

const bare500 = () => new ApiError(500, 'http_error', 'Internal Server Error');
const kept = () => storedDrafts().map(([id]) => id);

function Drafts() {
  useTicketDrafts(true);
  return null;
}

function setup(checkHealth: () => Promise<unknown>) {
  const updateTicket = vi
    .fn()
    .mockRejectedValueOnce(bare500())
    .mockResolvedValue(makeTicketDetail().ticket);
  const api = setupApi({
    getTicket: vi.fn().mockResolvedValue(makeTicketDetail()),
    updateTicket,
    checkHealth,
  });
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  return { updateTicket, api };
}

const flush = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  keepDraft('title:MOB-1', { ticketKey: 'MOB-1', field: 'title', text: 'Fix it' }, 'Ticket 1');
});

afterEach(() => {
  vi.useRealTimers();
});

it("retries a closed ticket's text after a bare 5xx the tracker answers its check around", async () => {
  const { updateTicket } = setup(vi.fn().mockResolvedValue({ ok: true }));
  await flush(0);
  expect(updateTicket).toHaveBeenCalledTimes(1);
  expect(kept()).toEqual(['title:MOB-1']);

  await flush(RETRY_GAP_MS - 1);
  expect(updateTicket).toHaveBeenCalledTimes(1);
  await flush(1);

  expect(updateTicket).toHaveBeenCalledTimes(2);
  expect(kept()).toEqual([]);
});

it('retries it once the tracker answers again, when the check got no answer either', async () => {
  const { updateTicket, api } = setup(vi.fn().mockRejectedValue(bare500()));
  await flush(0);
  expect(updateTicket).toHaveBeenCalledTimes(1);
  await flush(2 * RETRY_GAP_MS);
  expect(updateTicket).toHaveBeenCalledTimes(1);

  await act(() => api.queryClient.fetchQuery({ queryKey: ['meta'], queryFn: () => 'up' }));
  await flush(RETRY_GAP_MS);

  expect(updateTicket).toHaveBeenCalledTimes(2);
  expect(kept()).toEqual([]);
});
