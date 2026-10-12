import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft, storedDrafts } from '../../src/lib/storedDrafts';

// WebKit kept navigator.onLine false for 20 minutes while every request was answered (PT-179), and
// text kept after a failed save was never retried: the retries didn't try while the browser said
// offline.

function Drafts() {
  useTicketDrafts(true);
  return null;
}

function renderDrafts(getTicket: () => Promise<unknown>) {
  const updateTicket = vi.fn().mockResolvedValue(makeTicketDetail().ticket);
  const api = setupApi({ getTicket, updateTicket });
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  return updateTicket;
}

const kept = () => storedDrafts().map(([id]) => id);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  keepDraft(
    'title:MOB-1',
    { ticketKey: 'MOB-1', field: 'title', text: 'Fix the login' },
    'Ticket 1',
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('saves kept text while the browser says it is offline and the tracker answers', async () => {
  const updateTicket = renderDrafts(vi.fn().mockResolvedValue(makeTicketDetail()));

  await act(() => vi.advanceTimersByTimeAsync(0));

  expect(updateTicket).toHaveBeenCalledWith(
    'MOB-1',
    { title: 'Fix the login' },
    { title: 'Ticket 1' },
  );
  expect(kept()).toEqual([]);
});

it('keeps the text when the read gets no answer', async () => {
  const updateTicket = renderDrafts(vi.fn().mockRejectedValue(new TypeError('Load failed')));

  await act(() => vi.advanceTimersByTimeAsync(0));

  expect(updateTicket).not.toHaveBeenCalled();
  expect(kept()).toEqual(['title:MOB-1']);
});
