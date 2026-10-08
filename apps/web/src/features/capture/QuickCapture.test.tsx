import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../api/test/deferred';
import { listItem, STATUS } from '../../api/test/fixtures';
import { createReachability } from '../../app/reachability';
import { SheetsProvider } from '../../app/sheets/SheetsProvider';
import { projectSummary, renderWithApp, type HarnessOptions } from '../../app/test/harness';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import type { QueuedCapture } from './captureQueue';
import { QUEUE_STORAGE_KEY, readQueue } from './queueStore';
import { QuickCapture } from './QuickCapture';

const NETWORK_DOWN = new TypeError('Failed to fetch');

const queued = (id: string, capturedAt: number, overrides: Partial<QueuedCapture> = {}) => ({
  id,
  projectKey: 'MOB',
  title: `Idea ${id}`,
  description: '',
  priority: 'medium' as const,
  capturedAt,
  ...overrides,
});

const ticketFor = (projectKey: string, input: { title: string }): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    ...ticket
  } = listItem(1, STATUS.todo, 0, {
    key: `${projectKey}-1`,
    title: input.title,
  });
  return ticket;
};

function storeQueue(items: QueuedCapture[]) {
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items, created: [] }));
}

function SearchProbe() {
  return <output aria-label="Search params">{useLocation().search}</output>;
}

function renderQuickCapture(client: HarnessOptions['client'] = {}, path = '/') {
  const reachability = createReachability();
  const createTicket = vi.fn((projectKey: string, input: { title: string }) =>
    Promise.resolve(ticketFor(projectKey, input)),
  );
  const app = renderWithApp(
    <SheetsProvider>
      <QuickCapture reachability={reachability} />
      <input aria-label="Search tickets" />
      <SearchProbe />
    </SheetsProvider>,
    {
      path,
      projects: [projectSummary()],
      client: {
        listProjects: vi.fn().mockResolvedValue([projectSummary()]),
        createTicket,
        ...client,
      },
    },
  );
  return { ...app, reachability, createTicket, user: userEvent.setup() };
}

const createdTitles = (createTicket: ReturnType<typeof vi.fn>) =>
  createTicket.mock.calls.map(([, input]) => (input as { title: string }).title);

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('QuickCapture sync', () => {
  it('adds the captures saved on this device when the app starts, oldest first', async () => {
    storeQueue([queued('b', 20), queued('a', 10)]);
    const { createTicket } = renderQuickCapture();

    expect(await screen.findByText('2 tickets added')).toBeInTheDocument();
    expect(createdTitles(createTicket)).toEqual(['Idea a', 'Idea b']);
    expect(readQueue().items).toEqual([]);
  });

  it('tries again when the tracker can be reached again, with the same client id', async () => {
    storeQueue([queued('a', 10)]);
    const createTicket = vi
      .fn()
      .mockRejectedValueOnce(NETWORK_DOWN)
      .mockImplementation((projectKey: string, input: { title: string }) =>
        Promise.resolve(ticketFor(projectKey, input)),
      );
    const { reachability } = renderQuickCapture({ createTicket });
    await waitFor(() => expect(createTicket).toHaveBeenCalledTimes(1));
    await act(async () => {
      for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve));
    });

    act(() => {
      reachability.setUnreachable(true);
      reachability.setUnreachable(false);
    });

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    const clientIds = createTicket.mock.calls.map(
      ([, input]) => (input as { clientId?: string }).clientId,
    );
    expect(clientIds).toEqual(['a', 'a']);
    expect(readQueue().items).toEqual([]);
  });

  it('tries again when the device comes back online', async () => {
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    storeQueue([queued('a', 10)]);
    const { createTicket } = renderQuickCapture();
    await act(() => Promise.resolve());
    expect(createTicket).not.toHaveBeenCalled();

    offline.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
  });

  it('sends nothing twice when several triggers arrive at once', async () => {
    storeQueue([queued('a', 10)]);
    const answer = deferred<Ticket>();
    const createTicket = vi.fn(() => answer.promise);
    renderQuickCapture({ createTicket });
    await waitFor(() => expect(createTicket).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    answer.resolve(ticketFor('MOB', { title: 'Idea a' }));

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(createTicket).toHaveBeenCalledTimes(1);
  });

  it('names a capture the server refuses for good, and drops it', async () => {
    storeQueue([queued('gone', 10, { projectKey: 'OLD', title: 'Lost idea' })]);
    const refused = new ApiError(404, 'not_found', 'Project OLD was not found.');
    renderQuickCapture({ createTicket: vi.fn().mockRejectedValue(refused) });

    expect(await screen.findByText("Couldn't add “Lost idea”")).toBeInTheDocument();
    expect(readQueue().items).toEqual([]);
  });
});

describe('QuickCapture shortcut and link', () => {
  it('opens quick capture with C, without typing the letter', async () => {
    const { user } = renderQuickCapture();
    await user.keyboard('c');
    const dialog = await screen.findByRole('dialog', { name: 'New ticket' });
    expect(within(dialog).getByLabelText('Ticket title')).toHaveValue('');
    expect(within(dialog).getByLabelText('Ticket title')).toHaveFocus();
  });

  it('leaves C to text fields and to a sheet that is already open', async () => {
    const { user } = renderQuickCapture();
    await user.click(screen.getByLabelText('Search tickets'));
    await user.keyboard('c');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Search tickets')).toHaveValue('c');

    await user.click(document.body);
    await user.keyboard('C');
    const dialog = await screen.findByRole('dialog', { name: 'New ticket' });
    await user.type(within(dialog).getByLabelText('Ticket title'), 'Kept');
    within(dialog).getByRole('button', { name: 'Cancel' }).focus();
    await user.keyboard('c');
    expect(within(screen.getByRole('dialog')).getByLabelText('Ticket title')).toHaveValue('Kept');
  });

  it('opens quick capture from ?capture and cleans the address', async () => {
    renderQuickCapture({}, '/?capture');
    expect(await screen.findByRole('dialog', { name: 'New ticket' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Search params' })).toBeEmptyDOMElement(),
    );
  });
});
