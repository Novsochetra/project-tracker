import { describe, expect, it, vi } from 'vitest';
import { OPEN_MESSAGE } from './openMessage';
import { listenForPushes } from './pushEvents';
import type { NotificationClickLike, PushEventLike, WindowClientLike } from './workerTypes';

const ORIGIN = 'https://tracker.example.com';

function fakeWorker(windows: WindowClientLike[] = []) {
  const listeners = new Map<string, (event: never) => void>();
  const scope = {
    location: { origin: ORIGIN },
    clients: {
      matchAll: vi.fn(() => Promise.resolve(windows)),
      openWindow: vi.fn(() => Promise.resolve(null)),
    },
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    addEventListener: (type: string, listener: (event: never) => void) => {
      listeners.set(type, listener);
    },
  };
  listenForPushes(scope);
  const fire = async (type: string, event: object) => {
    let work: Promise<unknown> = Promise.resolve();
    const waitUntil = (promise: Promise<unknown>) => {
      work = promise;
    };
    listeners.get(type)?.({ ...event, waitUntil } as never);
    await work;
  };
  return {
    scope,
    push: (data: PushEventLike['data']) => fire('push', { data }),
    click: (data: unknown, close = vi.fn()) =>
      fire('notificationclick', { notification: { data, close } } satisfies Omit<
        NotificationClickLike,
        'waitUntil'
      >),
  };
}

const openWindow = (url: string): WindowClientLike => ({
  url,
  focus: vi.fn(() => Promise.resolve()),
  postMessage: vi.fn(),
});

describe('push', () => {
  it('shows what the tracker sent, with the page to open', async () => {
    const worker = fakeWorker();
    const message = {
      title: 'MOB-3: Claude finished',
      body: 'Fix login',
      url: '/p/MOB/3',
      tag: 't',
    };
    await worker.push({ json: () => message });
    expect(worker.scope.registration.showNotification).toHaveBeenCalledWith(
      'MOB-3: Claude finished',
      { body: 'Fix login', icon: '/icon-192.png', data: { path: '/p/MOB/3' }, tag: 't' },
    );
  });

  it('still shows a notification for an empty or unreadable push', async () => {
    const worker = fakeWorker();
    await worker.push(null);
    await worker.push({
      json: () => {
        throw new SyntaxError('Unexpected token');
      },
    });
    for (const call of worker.scope.registration.showNotification.mock.calls as unknown[][]) {
      expect(call).toEqual(['Tracker', { body: '', icon: '/icon-192.png', data: { path: '/' } }]);
    }
  });

  it('never keeps an address outside the app', async () => {
    const worker = fakeWorker();
    await worker.push({ json: () => ({ title: 'x', url: '//evil.example/p' }) });
    await worker.push({ json: () => ({ title: 'x', url: 'https://evil.example/' }) });
    for (const call of worker.scope.registration.showNotification.mock.calls as unknown[][]) {
      expect(call[1]).toMatchObject({ data: { path: '/' } });
    }
  });
});

describe('notification tap', () => {
  it('brings the open app forward and tells it which page to show', async () => {
    const elsewhere = openWindow('https://other.example/');
    const app = openWindow(`${ORIGIN}/p/MOB`);
    const worker = fakeWorker([elsewhere, app]);
    const close = vi.fn();
    await worker.click({ path: '/p/MOB/ask/c-1' }, close);
    expect(close).toHaveBeenCalled();
    expect(app.focus).toHaveBeenCalled();
    expect(app.postMessage).toHaveBeenCalledWith({ type: OPEN_MESSAGE, path: '/p/MOB/ask/c-1' });
    expect(elsewhere.focus).not.toHaveBeenCalled();
    expect(worker.scope.clients.openWindow).not.toHaveBeenCalled();
  });

  it('opens the app on the page when no window of it is open', async () => {
    const worker = fakeWorker();
    await worker.click({ path: '/p/MOB/3' });
    expect(worker.scope.clients.openWindow).toHaveBeenCalledWith('/p/MOB/3');
    await worker.click({ path: '//evil.example' });
    expect(worker.scope.clients.openWindow).toHaveBeenLastCalledWith('/');
  });
});
