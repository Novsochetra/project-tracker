import { ApiError } from '@tracker/client';
import { listTicketsQuery, type ListTicketsQuery, type Ticket } from '@tracker/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listItem, STATUS } from '../../src/api/test/fixtures';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp, type HarnessOptions } from '../../src/app/test/harness';
import type { QueuedCapture } from '../../src/features/capture/captureQueue';
import { QUEUE_STORAGE_KEY, readQueue } from '../../src/features/capture/queueStore';
import { QuickCapture } from '../../src/features/capture/QuickCapture';

// Before sending an attempted capture again, the sync looks for its ticket by searching for the
// title. Titles may be 300 characters long but a search at most 200, so a long title got a 400,
// which the sync took for a refusal of the capture: it dropped it and no ticket was ever made.

const LONG_TITLE = `Long title ${'x'.repeat(230)} with words at the end`;

const capture = (overrides: Partial<QueuedCapture> = {}): QueuedCapture => ({
  id: 'long',
  projectKey: 'MOB',
  title: LONG_TITLE,
  description: 'Steps',
  priority: 'medium',
  capturedAt: 1_000,
  attempted: true,
  ...overrides,
});

const ticket = (title: string, description = 'Steps'): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    ...rest
  } = listItem(1, STATUS.todo, 0, {
    title,
    description,
    createdAt: 2_000,
  });
  return rest;
};

// Like the server: a query it can't accept gets a 400, otherwise titles containing the text.
const searchLikeTheServer = (tickets: Ticket[]) =>
  vi.fn((_key: string, query: ListTicketsQuery) => {
    if (!listTicketsQuery.safeParse(query).success) {
      return Promise.reject(new ApiError(400, 'validation_error', 'Invalid query.'));
    }
    const text = (query.q ?? '').trim().toLowerCase();
    return Promise.resolve(tickets.filter((item) => item.title.toLowerCase().includes(text)));
  });

function storeQueue(items: QueuedCapture[]) {
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items, created: [] }));
}

function renderSync(client: HarnessOptions['client']) {
  renderWithApp(
    <SheetsProvider>
      <QuickCapture reachability={createReachability()} />
    </SheetsProvider>,
    { projects: [projectSummary()], client },
  );
}

const finishRuns = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

const createdTitles = (createTicket: ReturnType<typeof vi.fn>) =>
  createTicket.mock.calls.map(([, input]) => (input as { title: string }).title);

afterEach(() => {
  window.localStorage.clear();
});

describe('regression: a capture with a long title is never lost', () => {
  it('looks it up with a search the server accepts, then adds it', async () => {
    storeQueue([capture()]);
    const listTickets = searchLikeTheServer([]);
    const createTicket = vi.fn((_key: string, input: { title: string }) =>
      Promise.resolve(ticket(input.title)),
    );
    renderSync({ listTickets, createTicket });

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(createdTitles(createTicket)).toEqual([LONG_TITLE]);
    expect(readQueue().items).toEqual([]);
  });

  it('finds the ticket an earlier request made, comparing the whole title', async () => {
    storeQueue([capture()]);
    const sameStart = ticket(`${LONG_TITLE} but longer`);
    const listTickets = searchLikeTheServer([sameStart, ticket(LONG_TITLE)]);
    const createTicket = vi.fn();
    renderSync({ listTickets, createTicket });

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
    expect(readQueue().items).toEqual([]);
  });

  it.each([
    ['refused', new ApiError(400, 'validation_error', 'Invalid query.')],
    ['answered with a server error', new ApiError(503, 'http_error', 'Unavailable')],
    ['cut off', new TypeError('Failed to fetch')],
  ])('keeps the capture for a later sync when the lookup is %s', async (_how, error) => {
    storeQueue([capture()]);
    const listTickets = vi.fn().mockRejectedValue(error);
    const createTicket = vi.fn();
    renderSync({ listTickets, createTicket });
    await waitFor(() => expect(listTickets).toHaveBeenCalled());
    await finishRuns();

    expect(createTicket).not.toHaveBeenCalled();
    expect(readQueue().items).toEqual([capture()]);
    expect(screen.queryByText(/^Couldn't add/)).not.toBeInTheDocument();
  });

  it('names a capture the server refuses for good in a toast short enough for a phone', async () => {
    storeQueue([capture({ attempted: false, projectKey: 'OLD' })]);
    const refused = new ApiError(404, 'not_found', 'Project OLD was not found.');
    renderSync({ createTicket: vi.fn().mockRejectedValue(refused) });

    const toast = await screen.findByText(/^Couldn't add/);
    // About 40 characters fit on one line in a 375px toast (checked in WebKit and Chromium).
    expect(toast.textContent).toMatch(/^Couldn't add “Long title x+…”$/);
    expect(toast.textContent?.length).toBeLessThanOrEqual(40);
    expect(readQueue().items).toEqual([]);
  });
});
