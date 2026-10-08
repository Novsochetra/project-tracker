import type { CreateTicketInput, ListTicketsQuery } from '@tracker/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { QUEUE_STORAGE_KEY, readQueue } from '../../src/features/capture/queueStore';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import { fakeTracker } from '../../src/features/capture/test/fakeTracker';

// A phone reaches the tracker over plain http on the LAN address, where browsers have no Web
// Locks, so a capture's lease lives in localStorage. Two tabs came back online at the same moment
// with a capture waiting. In Chromium one tab's localStorage writes reach the other a moment
// later, so each tab found the lease free and the capture waiting, and both sent it: two tickets.

const WAITING = JSON.stringify({
  items: [
    {
      id: 'c-1',
      projectKey: 'MOB',
      title: 'Written in the tunnel',
      description: '',
      priority: 'medium',
      capturedAt: 1,
    },
  ],
  created: [],
});

afterEach(() => {
  window.localStorage.clear();
});

function renderTab() {
  const tracker = fakeTracker();
  const createTicket = vi.fn((projectKey: string, input: CreateTicketInput) =>
    Promise.resolve(tracker.create(projectKey, input)),
  );
  renderWithApp(
    <SheetsProvider>
      <QuickCapture reachability={createReachability()} />
    </SheetsProvider>,
    {
      projects: [projectSummary()],
      client: {
        listTickets: vi.fn((projectKey: string, query?: ListTicketsQuery) =>
          Promise.resolve(tracker.search(projectKey, query)),
        ),
        createTicket,
      },
    },
  );
  return { tracker, createTicket };
}

describe('regression: two tabs without Web Locks sync the same capture at once', () => {
  it('makes one ticket of it', async () => {
    expect(navigator.locks).toBeUndefined();
    window.localStorage.setItem(QUEUE_STORAGE_KEY, WAITING);
    const { tracker, createTicket } = renderTab();
    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();

    // The second tab read the lease and the queue before the first tab's writes reached it.
    act(() => {
      window.localStorage.setItem(QUEUE_STORAGE_KEY, WAITING);
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(createTicket).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readQueue().items).toEqual([]));

    expect(tracker.titles()).toEqual(['Written in the tunnel']);
    expect(createTicket.mock.calls.map(([, input]) => input.clientId)).toEqual(['c-1', 'c-1']);
  });
});
