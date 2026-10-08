import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../../api/test/deferred';
import { addCapture, type CaptureQueue, type QueuedCapture } from './captureQueue';
import type { QueueAccess } from './queueStore';
import { matchesCapture, syncCaptures, type SyncDeps } from './syncCaptures';

const capture = (id: string, capturedAt: number, overrides: Partial<QueuedCapture> = {}) => ({
  id,
  projectKey: 'MOB',
  title: `Idea ${id}`,
  description: '',
  priority: 'medium' as const,
  capturedAt,
  attempted: false,
  ...overrides,
});

const ticketFor = (item: QueuedCapture, overrides: Partial<Ticket> = {}): Ticket => ({
  id: `t-${item.id}`,
  projectId: 'p-mob',
  num: 1,
  key: 'MOB-1',
  statusId: 's-todo',
  rank: 0,
  title: item.title,
  description: item.description,
  priority: item.priority,
  assignee: '',
  due: '',
  createdAt: item.capturedAt,
  updatedAt: item.capturedAt,
  ...overrides,
});

function memoryQueue(items: QueuedCapture[], created: string[] = []) {
  let queue: CaptureQueue = { items, created };
  let failWrites = false;
  const access: QueueAccess = {
    read: () => queue,
    update: (change) => {
      if (failWrites) return false;
      queue = change(queue);
      return true;
    },
  };
  return {
    access,
    current: () => queue,
    failWrites: () => void (failWrites = true),
  };
}

const NETWORK_DOWN = new TypeError('Failed to fetch');

function deps(queue: QueueAccess, overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    queue,
    send: vi.fn((item: QueuedCapture) => Promise.resolve(ticketFor(item))),
    exists: vi.fn(() => Promise.resolve(false)),
    ...overrides,
  };
}

const sentIds = (send: SyncDeps['send']) => vi.mocked(send).mock.calls.map(([item]) => item.id);

describe('syncCaptures', () => {
  it('sends captures oldest first and empties the queue', async () => {
    const store = memoryQueue([capture('b', 20), capture('a', 10), capture('c', 30)]);
    const sync = deps(store.access);

    const report = await syncCaptures(sync);

    expect(sentIds(sync.send)).toEqual(['a', 'b', 'c']);
    expect(report.added.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(report.stopped).toBe(false);
    expect(store.current()).toEqual({ items: [], created: ['a', 'b', 'c'] });
  });

  it('sends one at a time, waiting for each answer', async () => {
    const store = memoryQueue([capture('a', 1), capture('b', 2)]);
    const first = deferred<Ticket>();
    const send = vi.fn((item: QueuedCapture) =>
      item.id === 'a' ? first.promise : Promise.resolve(ticketFor(item)),
    );

    const running = syncCaptures(deps(store.access, { send }));
    await Promise.resolve();
    expect(sentIds(send)).toEqual(['a']);

    first.resolve(ticketFor(capture('a', 1)));
    await running;
    expect(sentIds(send)).toEqual(['a', 'b']);
  });

  it('keeps a capture that could not be sent, with everything after it', async () => {
    const store = memoryQueue([capture('a', 1), capture('b', 2)]);
    const sync = deps(store.access, { send: vi.fn(() => Promise.reject(NETWORK_DOWN)) });

    const report = await syncCaptures(sync);

    expect(report).toEqual({ added: [], dropped: [], stopped: true });
    expect(sentIds(sync.send)).toEqual(['a']);
    expect(store.current().items.map(({ id, attempted }) => [id, attempted])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('keeps what is left after a partial success', async () => {
    const store = memoryQueue([capture('a', 1), capture('b', 2), capture('c', 3)]);
    const send = vi.fn((item: QueuedCapture) =>
      item.id === 'b'
        ? Promise.reject(new ApiError(503, 'http_error', 'Unavailable'))
        : Promise.resolve(ticketFor(item)),
    );

    const report = await syncCaptures(deps(store.access, { send }));

    expect(report.added.map(({ id }) => id)).toEqual(['a']);
    expect(report.stopped).toBe(true);
    expect(store.current().items.map(({ id }) => id)).toEqual(['b', 'c']);
    expect(store.current().created).toEqual(['a']);
  });

  it('never sends a capture that was already created', async () => {
    const store = memoryQueue([capture('a', 1), capture('b', 2)], ['a']);
    const sync = deps(store.access);

    await syncCaptures(sync);

    expect(sentIds(sync.send)).toEqual(['b']);
  });

  it('looks for the ticket before sending a capture whose answer may have been lost', async () => {
    const lost = capture('a', 1, { attempted: true });
    const store = memoryQueue([lost, capture('b', 2)]);
    const exists = vi.fn((item: QueuedCapture) => Promise.resolve(item.id === 'a'));
    const sync = deps(store.access, { exists });

    const report = await syncCaptures(sync);

    expect(exists).toHaveBeenCalledTimes(1);
    expect(sentIds(sync.send)).toEqual(['b']);
    expect(report.added.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(store.current().items).toEqual([]);
  });

  it('leaves captures alone while another request is sending them', async () => {
    const store = memoryQueue([capture('a', 1), capture('b', 2)]);
    const sync = deps(store.access, { busy: () => new Set(['a']) });

    await syncCaptures(sync);

    expect(sentIds(sync.send)).toEqual(['b']);
    expect(store.current().items.map(({ id }) => id)).toEqual(['a']);
  });

  it('asks before each capture which ones are being sent, since that changes mid-run', async () => {
    const store = memoryQueue([capture('a', 1)]);
    const sending = new Set<string>();
    const send = vi.fn((item: QueuedCapture) => {
      if (item.id === 'a') {
        sending.add('late');
        store.access.update((queue) => addCapture(queue, capture('late', 2, { attempted: true })));
      }
      return Promise.resolve(ticketFor(item));
    });

    await syncCaptures(deps(store.access, { send, busy: () => sending }));

    expect(sentIds(send)).toEqual(['a']);
    expect(store.current().items.map(({ id }) => id)).toEqual(['late']);
  });

  it('drops a capture the server refuses for good and goes on with the rest', async () => {
    const store = memoryQueue([capture('gone', 1, { projectKey: 'OLD' }), capture('b', 2)]);
    const send = vi.fn((item: QueuedCapture) =>
      item.id === 'gone'
        ? Promise.reject(new ApiError(404, 'not_found', 'Project OLD was not found.'))
        : Promise.resolve(ticketFor(item)),
    );

    const report = await syncCaptures(deps(store.access, { send }));

    expect(report.dropped).toEqual([
      {
        capture: capture('gone', 1, { projectKey: 'OLD', attempted: false }),
        message: 'Project OLD was not found.',
      },
    ]);
    expect(report.added.map(({ id }) => id)).toEqual(['b']);
    expect(store.current()).toEqual({ items: [], created: ['b'] });
  });

  it('stops on a sign-in prompt instead of dropping the capture', async () => {
    const store = memoryQueue([capture('a', 1)]);
    const send = vi.fn(() => Promise.reject(new ApiError(401, 'unauthorized', 'Sign in')));

    const report = await syncCaptures(deps(store.access, { send }));

    expect(report.stopped).toBe(true);
    expect(store.current().items).toHaveLength(1);
  });

  it('stops without sending when storage can no longer be written', async () => {
    const store = memoryQueue([capture('a', 1)]);
    store.failWrites();
    const sync = deps(store.access);

    const report = await syncCaptures(sync);

    expect(report.stopped).toBe(true);
    expect(sync.send).not.toHaveBeenCalled();
  });

  it('sends nothing twice in one run, even when the result cannot be saved', async () => {
    const store = memoryQueue([capture('a', 1)]);
    let writes = 0;
    const access: QueueAccess = {
      read: store.access.read,
      // The attempted mark is saved; the created mark after sending is not.
      update: (change) => (writes++ === 0 ? store.access.update(change) : false),
    };
    const sync = deps(access);

    const report = await syncCaptures(sync);

    expect(sentIds(sync.send)).toEqual(['a']);
    expect(report).toMatchObject({ stopped: true });
  });

  it('picks up a capture added while the run is going', async () => {
    const store = memoryQueue([capture('a', 1)]);
    const send = vi.fn((item: QueuedCapture) => {
      if (item.id === 'a') store.access.update((queue) => addCapture(queue, capture('b', 2)));
      return Promise.resolve(ticketFor(item));
    });

    await syncCaptures(deps(store.access, { send }));

    expect(sentIds(send)).toEqual(['a', 'b']);
  });
});

describe('matchesCapture', () => {
  const item = capture('a', 1_000_000, { title: 'Fix login', description: 'On iOS' });

  it('matches the ticket with the same text made after the capture', () => {
    expect(matchesCapture(ticketFor(item, { createdAt: 1_000_500 }), item)).toBe(true);
  });

  it('allows for a server clock a little behind the phone', () => {
    expect(matchesCapture(ticketFor(item, { createdAt: 1_000_000 - 60_000 }), item)).toBe(true);
  });

  it('does not match other text or an older ticket', () => {
    expect(matchesCapture(ticketFor(item, { title: 'Fix login now' }), item)).toBe(false);
    expect(matchesCapture(ticketFor(item, { description: '' }), item)).toBe(false);
    expect(matchesCapture(ticketFor(item, { createdAt: 1_000_000 - 10 * 60_000 }), item)).toBe(
      false,
    );
  });
});
