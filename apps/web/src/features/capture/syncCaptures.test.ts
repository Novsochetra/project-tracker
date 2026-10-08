import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../../api/test/deferred';
import { addCapture, markAttempted, type CaptureQueue, type QueuedCapture } from './captureQueue';
import type { QueueAccess } from './queueStore';
import { syncCaptures, type SyncDeps } from './syncCaptures';

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

// Claims as the lock manager would: refused while a request elsewhere holds the capture.
const claimsExcept = (held: ReadonlySet<string> = new Set()) =>
  vi.fn((id: string) => Promise.resolve(held.has(id) ? null : () => undefined));

function deps(queue: QueueAccess, overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    queue,
    send: vi.fn((item: QueuedCapture) => Promise.resolve(ticketFor(item))),
    exists: vi.fn(() => Promise.resolve(false)),
    claim: claimsExcept(),
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
    await vi.waitFor(() => expect(sentIds(send)).toEqual(['a']));
    await new Promise((resolve) => setTimeout(resolve, 0));
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

  it('leaves captures alone while a request in any tab holds their lock', async () => {
    const store = memoryQueue([capture('a', 1, { attempted: true }), capture('b', 2)]);
    const sync = deps(store.access, { claim: claimsExcept(new Set(['a'])) });

    const report = await syncCaptures(sync);

    expect(sync.exists).not.toHaveBeenCalled();
    expect(sentIds(sync.send)).toEqual(['b']);
    expect(report).toMatchObject({ stopped: false });
    expect(store.current().items.map(({ id }) => id)).toEqual(['a']);
  });

  it('asks for each lock just before sending, since captures join mid-run', async () => {
    const store = memoryQueue([capture('a', 1)]);
    const sending = new Set<string>();
    const send = vi.fn((item: QueuedCapture) => {
      if (item.id === 'a') {
        sending.add('late');
        store.access.update((queue) => addCapture(queue, capture('late', 2, { attempted: true })));
      }
      return Promise.resolve(ticketFor(item));
    });

    await syncCaptures(deps(store.access, { send, claim: claimsExcept(sending) }));

    expect(sentIds(send)).toEqual(['a']);
    expect(store.current().items.map(({ id }) => id)).toEqual(['late']);
  });

  it('releases each lock once the result is recorded, and after a failure too', async () => {
    const store = memoryQueue([capture('a', 1), capture('b', 2)]);
    const releases: Array<[string, boolean]> = [];
    const claim = vi.fn((id: string) =>
      Promise.resolve(() => void releases.push([id, store.current().created.includes(id)])),
    );
    const send = vi.fn((item: QueuedCapture) =>
      item.id === 'b' ? Promise.reject(NETWORK_DOWN) : Promise.resolve(ticketFor(item)),
    );

    await syncCaptures(deps(store.access, { send, claim }));

    expect(releases).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('reads a capture again once its lock is taken, since another tab may have sent it', async () => {
    const store = memoryQueue([capture('a', 1), capture('b', 2)]);
    const claim = vi.fn((id: string) => {
      // While this run waited for the lock, another tab tried 'a' and created 'b'.
      if (id === 'a') store.access.update((queue) => markAttempted(queue, 'a'));
      if (id === 'b') store.access.update((queue) => ({ ...queue, created: ['b'] }));
      return Promise.resolve(() => undefined);
    });
    const exists = vi.fn(() => Promise.resolve(true));
    const sync = deps(store.access, { claim, exists });

    const report = await syncCaptures(sync);

    expect(exists).toHaveBeenCalledWith(capture('a', 1, { attempted: true }));
    expect(sync.send).not.toHaveBeenCalled();
    expect(report.added.map(({ id }) => id)).toEqual(['a']);
  });

  it.each([
    ['refused', new ApiError(400, 'validation_error', 'Invalid query.')],
    ['answered with a server error', new ApiError(503, 'http_error', 'Unavailable')],
    ['cut off', NETWORK_DOWN],
  ])('stops and keeps the capture when the lookup is %s', async (_how, error) => {
    const store = memoryQueue([capture('a', 1, { attempted: true }), capture('b', 2)]);
    const sync = deps(store.access, { exists: vi.fn(() => Promise.reject(error)) });

    const report = await syncCaptures(sync);

    expect(report).toEqual({ added: [], dropped: [], stopped: true });
    expect(sync.send).not.toHaveBeenCalled();
    expect(store.current().items.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('leaves it to the create when the lookup finds no project, and drops it on the refusal', async () => {
    const gone = capture('gone', 1, { attempted: true, projectKey: 'OLD' });
    const store = memoryQueue([gone]);
    const notFound = new ApiError(404, 'not_found', 'Project OLD was not found.');
    const sync = deps(store.access, {
      exists: vi.fn(() => Promise.reject(notFound)),
      send: vi.fn(() => Promise.reject(notFound)),
    });

    const report = await syncCaptures(sync);

    expect(sentIds(sync.send)).toEqual(['gone']);
    expect(report.dropped).toEqual([gone]);
    expect(store.current().items).toEqual([]);
  });

  it('drops a capture the server refuses for good and goes on with the rest', async () => {
    const store = memoryQueue([capture('gone', 1, { projectKey: 'OLD' }), capture('b', 2)]);
    const send = vi.fn((item: QueuedCapture) =>
      item.id === 'gone'
        ? Promise.reject(new ApiError(404, 'not_found', 'Project OLD was not found.'))
        : Promise.resolve(ticketFor(item)),
    );

    const report = await syncCaptures(deps(store.access, { send }));

    expect(report.dropped).toEqual([capture('gone', 1, { projectKey: 'OLD' })]);
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
