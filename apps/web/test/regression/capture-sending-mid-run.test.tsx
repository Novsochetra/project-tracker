import type { Ticket } from '@tracker/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { listItem, STATUS } from '../../src/api/test/fixtures';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { addCapture, type QueuedCapture } from '../../src/features/capture/captureQueue';
import { QUEUE_STORAGE_KEY, readQueue, updateQueue } from '../../src/features/capture/queueStore';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import { trackSending } from '../../src/features/capture/syncRunner';

// A sync run read the captures still being sent by the sheet once, when it started. A slow
// capture joins the queue while its request is out; when a run was already going, the run sent
// it as well and the ticket was created twice.

const capture = (id: string, title: string, attempted: boolean): QueuedCapture => ({
  id,
  projectKey: 'MOB',
  title,
  description: '',
  priority: 'medium',
  capturedAt: 1,
  attempted,
});

const ticket = (title: string): Ticket => {
  const { commentCount: _c, attachmentCount: _a, ...rest } = listItem(1, STATUS.todo, 0, { title });
  return rest;
};

afterEach(() => {
  window.localStorage.clear();
});

describe('regression: a capture that starts sending mid-run is sent once', () => {
  it('leaves the slow capture to its own request', async () => {
    window.localStorage.setItem(
      QUEUE_STORAGE_KEY,
      JSON.stringify({ items: [capture('a', 'Queued idea', false)], created: [] }),
    );
    const first = deferred<Ticket>();
    const createTicket = vi.fn((_key: string, input: { title: string }) =>
      input.title === 'Queued idea' ? first.promise : Promise.resolve(ticket(input.title)),
    );
    renderWithApp(
      <SheetsProvider>
        <QuickCapture reachability={createReachability()} />
      </SheetsProvider>,
      {
        projects: [projectSummary()],
        client: { createTicket, listTickets: vi.fn().mockResolvedValue([]) },
      },
    );
    await waitFor(() => expect(createTicket).toHaveBeenCalledTimes(1));

    const untrack = trackSending('slow');
    act(() => {
      updateQueue((queue) => addCapture(queue, capture('slow', 'Slow idea', true)));
    });
    first.resolve(ticket('Queued idea'));

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(createTicket.mock.calls.map(([, input]) => input.title)).toEqual(['Queued idea']);
    expect(readQueue().items.map(({ id }) => id)).toEqual(['slow']);
    untrack();
  });
});
