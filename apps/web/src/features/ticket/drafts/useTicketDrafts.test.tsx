import { act, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { queryKeys } from '../../../api';
import { seedTicket, setupApi } from '../../../api/test/render';
import { ToastProvider } from '../../../components';
import { keepDraft, storedDrafts } from '../../../lib/storedDrafts';
import { SAVE_MARKS_STORAGE_KEY } from '../fields/saveMarks';
import { LEFT_SAVE_WAIT_MS, RETRY_GAP_MS, useTicketDrafts } from './useTicketDrafts';

function Drafts({ enabled }: { enabled: boolean }) {
  useTicketDrafts(enabled);
  return null;
}

function setup(overrides: Parameters<typeof setupApi>[0], enabled = true) {
  const api = setupApi({
    getTicket: vi.fn().mockResolvedValue(makeTicketDetail()),
    updateTicket: vi.fn().mockResolvedValue(makeTicketDetail().ticket),
    ...overrides,
  });
  const ui = (on: boolean) => (
    <api.wrapper>
      <ToastProvider>
        <Drafts enabled={on} />
      </ToastProvider>
    </api.wrapper>
  );
  const view = render(ui(enabled));
  return { ...api, enable: () => view.rerender(ui(true)) };
}

const keepTitle = (text: string, base = 'Ticket 1') =>
  keepDraft('title:MOB-1', { ticketKey: 'MOB-1', field: 'title', text }, base);

const kept = () => storedDrafts().map(([id]) => id);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useTicketDrafts', () => {
  it('saves text left in closed tickets once the app has a session', async () => {
    keepTitle('Fix the login');
    const { client, enable } = setup({}, false);
    expect(client.getTicket).not.toHaveBeenCalled();
    enable();
    await waitFor(() => expect(kept()).toEqual([]));
    expect(client.updateTicket).toHaveBeenCalledWith(
      'MOB-1',
      { title: 'Fix the login' },
      { title: 'Ticket 1' },
    );
  });

  it('keeps the text while the device is offline and saves when it comes back online', async () => {
    keepTitle('Fix the login');
    const getTicket = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(makeTicketDetail());
    setup({ getTicket });
    await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(1));
    expect(kept()).toEqual(['title:MOB-1']);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(kept()).toEqual([]));
  });

  it('does not run again because its own refused save refreshed the cache', async () => {
    vi.useFakeTimers();
    keepTitle('Too long for the tracker');
    const updateTicket = vi
      .fn()
      .mockRejectedValue(new ApiError(400, 'invalid_input', 'title: Too long'));
    const { queryClient } = setup({ updateTicket });
    seedTicket(queryClient);
    queryClient.setQueryData(queryKeys.projects(), []);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(updateTicket).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(3 * RETRY_GAP_MS));
    expect(updateTicket).toHaveBeenCalledTimes(1);
    expect(kept()).toEqual(['title:MOB-1']);
  });

  it('keeps text whose field changed meanwhile and says where it waits', async () => {
    keepTitle('Mine');
    const getTicket = vi
      .fn()
      .mockResolvedValue(makeTicketDetail(listItem(1, STATUS.todo, 0, { title: 'Theirs' })));
    const { client } = setup({ getTicket });
    expect(
      await screen.findByText("Your edit to MOB-1 isn't saved: it changed elsewhere."),
    ).toBeInTheDocument();
    expect(client.updateTicket).not.toHaveBeenCalled();
    expect(kept()).toEqual(['title:MOB-1']);
  });

  // Another tab's saves settling are its own to follow up; once that tab is gone (here, frozen
  // until its mark runs out), what it had on its way is this tab's to send (PT-135).
  it('runs when another tab’s mark runs out, not when another tab marks or unmarks a draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    keepTitle('Fix the login');
    const mark = { draft: 'title:MOB-1', page: 'frozen-tab', until: Date.now() + 60_000 };
    localStorage.setItem(`${SAVE_MARKS_STORAGE_KEY}:frozen-tab:title:MOB-1`, JSON.stringify(mark));
    const { client } = setup({});
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SAVE_MARKS_STORAGE_KEY }));
    });
    await act(() => vi.advanceTimersByTimeAsync(LEFT_SAVE_WAIT_MS * 2));
    expect(client.getTicket).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    await waitFor(() => expect(kept()).toEqual([]));
    expect(client.updateTicket).toHaveBeenCalledTimes(1);
  });
});
