import type { Ticket } from '@tracker/shared';
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { listItem, STATUS } from '../../src/api/test/fixtures';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { markCreated, type QueuedCapture } from '../../src/features/capture/captureQueue';
import { QUEUE_STORAGE_KEY, readQueue, updateQueue } from '../../src/features/capture/queueStore';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import {
  fakeLockManager,
  installLockManager,
} from '../../src/features/capture/test/fakeLockManager';

// Tab A's create got no answer within 8 s, so A put the capture in the shared queue, marked
// attempted, while its request kept going. Tab B synced meanwhile (opened, or switched to): its
// lookup found no ticket yet, so B sent the capture too, and once A's request landed there were
// two tickets. A's guard against sending a capture twice only covered A itself.

// While its request is out, a tab holds the capture's Web Lock or, where Web Locks are missing
// (a phone on a plain http address), a lease time in localStorage. Every open tab reads them.
const lockName = (id: string) => `tracker-capture-send:${id}`;
const leaseKey = (id: string) => `tracker.capture.sending.${id}`;

const slow: QueuedCapture = {
  id: 'slow',
  projectKey: 'MOB',
  title: 'Slow idea',
  description: '',
  priority: 'medium',
  capturedAt: Date.now(),
};

const ticket = (title: string): Ticket => {
  const { commentCount: _c, attachmentCount: _a, ...rest } = listItem(1, STATUS.todo, 0, { title });
  return rest;
};

interface OtherTab {
  release: () => void;
}

let cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
  window.localStorage.clear();
});

function tabWithWebLocks(id: string): OtherTab {
  const locks = fakeLockManager();
  cleanups.push(installLockManager(locks));
  const done = deferred<void>();
  void locks.request(lockName(id), () => done.promise);
  return { release: () => done.resolve() };
}

function tabWithLease(id: string, until = Date.now() + 60_000): OtherTab {
  window.localStorage.setItem(leaseKey(id), String(until));
  return { release: () => window.localStorage.removeItem(leaseKey(id)) };
}

function storeQueue(items: QueuedCapture[]) {
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items, created: [] }));
}

function renderTabB() {
  const createTicket = vi.fn((_key: string, input: { title: string }) =>
    Promise.resolve(ticket(input.title)),
  );
  renderWithApp(
    <SheetsProvider>
      <QuickCapture reachability={createReachability()} />
    </SheetsProvider>,
    { projects: [projectSummary()], client: { createTicket } },
  );
  return { createTicket };
}

// The sync runs on promises alone here, so a few turns of the event loop let a run finish.
const finishRuns = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

const syncAgain = async () => {
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  await finishRuns();
};

describe.each([
  ['with Web Locks', tabWithWebLocks],
  ['with a localStorage lease where Web Locks are missing', tabWithLease],
])('regression: another tab still sending a capture, %s', (_how, otherTab) => {
  it('leaves the capture to that tab instead of sending it again', async () => {
    storeQueue([slow]);
    const tabA = otherTab('slow');
    const { createTicket } = renderTabB();
    await finishRuns();
    expect(createTicket).not.toHaveBeenCalled();

    // Tab A's request lands: A records the ticket, then lets go.
    updateQueue((queue) => markCreated(queue, 'slow'));
    tabA.release();
    await syncAgain();

    expect(createTicket).not.toHaveBeenCalled();
    expect(readQueue().items).toEqual([]);
  });

  it("sends it once that tab's request failed after all, with the capture's client id", async () => {
    storeQueue([slow]);
    const tabA = otherTab('slow');
    const { createTicket } = renderTabB();
    await finishRuns();

    tabA.release();
    await syncAgain();

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(createTicket).toHaveBeenCalledWith('MOB', expect.objectContaining({ clientId: 'slow' }));
    expect(readQueue().items).toEqual([]);
  });
});

describe('regression: a lease left by a tab that closed mid-request', () => {
  it('stops counting once its time is up', async () => {
    storeQueue([slow]);
    tabWithLease('slow', Date.now() - 1);
    const { createTicket } = renderTabB();

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(createTicket).toHaveBeenCalledTimes(1);
  });
});
