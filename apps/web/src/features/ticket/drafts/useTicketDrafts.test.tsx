import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { setupApi } from '../../../api/test/render';
import { ToastProvider } from '../../../components';
import { keepDraft, storedDrafts } from '../../../lib/storedDrafts';
import { useTicketDrafts } from './useTicketDrafts';

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
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-1', { title: 'Fix the login' });
  });

  it('waits while the device is offline and saves when it comes back online', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    keepTitle('Fix the login');
    const { client } = setup({});
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(client.getTicket).not.toHaveBeenCalled();
    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(kept()).toEqual([]));
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
});
