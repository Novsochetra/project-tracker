import type { CreateTicketInput, ListTicketsQuery, Ticket } from '@tracker/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { CAPTURE_TIMEOUT_MS, SAVED_ON_PHONE } from '../../src/features/capture/captureForm';
import { readQueue } from '../../src/features/capture/queueStore';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import { fakeTracker } from '../../src/features/capture/test/fakeTracker';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Tab A created a capture from the sheet. No answer came within 8 s, so A kept the capture in the
// queue while its request went on, and then A was closed. Tab B synced: it looked the title up,
// found nothing yet and sent the capture again. Then the tracker committed A's request, which it
// had already received: two tickets for one capture.

interface InFlight {
  projectKey: string;
  input: CreateTicketInput;
  answer: Deferred<Ticket>;
}

let restore: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.useRealTimers();
  window.localStorage.clear();
});

function renderTabs() {
  const tracker = fakeTracker();
  const inFlight: InFlight[] = [];
  // Tab A's request reaches the tracker, which is slow to commit it; later requests get answers.
  const createTicket = vi.fn((projectKey: string, input: CreateTicketInput) => {
    if (createTicket.mock.calls.length === 1) {
      const answer = deferred<Ticket>();
      inFlight.push({ projectKey, input, answer });
      return answer.promise;
    }
    return Promise.resolve(tracker.create(projectKey, input));
  });
  renderWithApp(
    <SheetsProvider>
      <QuickCapture reachability={createReachability()} />
    </SheetsProvider>,
    {
      projects: [projectSummary()],
      client: {
        listProjects: vi.fn().mockResolvedValue([projectSummary()]),
        listTickets: vi.fn((projectKey: string, query?: ListTicketsQuery) =>
          Promise.resolve(tracker.search(projectKey, query)),
        ),
        createTicket,
      },
    },
  );
  return { tracker, inFlight, createTicket };
}

describe('regression: a capture whose tab closed mid-request', () => {
  it('becomes one ticket when another tab sends it again', async () => {
    const { tracker, inFlight, createTicket } = renderTabs();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.keyboard('c');
    const sheet = await screen.findByRole('dialog', { name: 'New ticket' });
    await user.type(within(sheet).getByLabelText('Ticket title'), 'Idea from the bus{Enter}');
    await act(() => vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS));
    expect(await screen.findByText(SAVED_ON_PHONE)).toBeInTheDocument();
    const [tabA] = inFlight;
    if (!tabA) throw new Error("Tab A's request was not sent.");

    // Tab A closes: the browser drops the request on A's side, but the tracker already has it.
    await act(async () => {
      tabA.answer.reject(new TypeError('Failed to fetch'));
      await vi.advanceTimersByTimeAsync(0);
    });
    // Tab B syncs, for example when the phone comes back online.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    tracker.create(tabA.projectKey, tabA.input);

    expect(tracker.titles()).toEqual(['Idea from the bus']);
    const [queued] = readQueue().created;
    expect(createTicket.mock.calls.map(([, input]) => input.clientId)).toEqual([queued, queued]);
  });
});
