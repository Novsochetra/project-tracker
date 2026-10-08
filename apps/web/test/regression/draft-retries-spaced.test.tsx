import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { RETRY_GAP_MS, useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft, storedDrafts } from '../../src/lib/storedDrafts';

const NETWORK_DOWN = new TypeError('Failed to fetch');

function Drafts() {
  useTicketDrafts(true);
  return null;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Seen in the browser with reads working and writes refused: each failed retry made the
// tracker look unreachable and the refetch after it reachable again, which started the next
// retry at once, about 25 saves in a second and a half.
it('spaces out retries started by the tracker answering again', async () => {
  keepDraft('title:MOB-1', { ticketKey: 'MOB-1', field: 'title', text: 'Fix it' }, 'Ticket 1');
  const getTicket = vi.fn().mockRejectedValue(NETWORK_DOWN);
  const api = setupApi({
    getTicket,
    updateTicket: vi.fn().mockResolvedValue(makeTicketDetail().ticket),
  });
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  const flush = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  const answer = async (ok: boolean) => {
    const queryFn = () => (ok ? Promise.resolve('up') : Promise.reject(NETWORK_DOWN));
    await act(() =>
      api.queryClient.fetchQuery({ queryKey: ['meta', ok], queryFn }).catch(() => ''),
    );
  };
  await flush(0);
  expect(getTicket).toHaveBeenCalledTimes(1);

  await answer(false);
  await answer(true);
  await answer(false);
  await answer(true);
  await flush(RETRY_GAP_MS - 1);
  expect(getTicket).toHaveBeenCalledTimes(1);

  getTicket.mockResolvedValue(makeTicketDetail());
  await flush(1);
  expect(getTicket).toHaveBeenCalledTimes(2);
  await flush(100);
  expect(storedDrafts()).toEqual([]);
});
