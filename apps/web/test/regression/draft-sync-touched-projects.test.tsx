import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { listItem, makeBoard, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { RETRY_GAP_MS, useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft } from '../../src/lib/storedDrafts';

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

// While an unsent comment sat in MOB-8 (it can sit there for days), every change the tracker
// reported anywhere read MOB-8 again, up to once every 10 s, to find out whether it was deleted.
it('reads a closed ticket with kept text again only after a change in its project', async () => {
  keepDraft('comment:MOB-8', { ticketKey: 'MOB-8', field: 'comment', text: 'Unsent words' }, '');
  const getTicket = vi.fn().mockResolvedValue(makeTicketDetail(listItem(8, STATUS.todo, 0)));
  const api = setupApi({ getTicket });
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  api.queryClient.setQueryData(queryKeys.board('WEB'), makeBoard([]));
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(getTicket).toHaveBeenCalledTimes(1);

  // Agents work in WEB; the live updates refresh its queries, the project list and Ready.
  for (let change = 0; change < 3; change += 1) {
    await act(() => api.queryClient.invalidateQueries({ queryKey: queryKeys.project('WEB') }));
    await act(() => api.queryClient.invalidateQueries({ queryKey: queryKeys.projects() }));
    await act(() => vi.advanceTimersByTimeAsync(RETRY_GAP_MS));
  }
  expect(getTicket).toHaveBeenCalledTimes(1);

  await act(() => api.queryClient.invalidateQueries({ queryKey: queryKeys.project('MOB') }));
  await act(() => vi.advanceTimersByTimeAsync(RETRY_GAP_MS));
  expect(getTicket).toHaveBeenCalledTimes(2);
});
