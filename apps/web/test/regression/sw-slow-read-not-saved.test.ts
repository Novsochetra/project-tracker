import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiReadStrategy } from '../../src/pwa/apiReadStrategy';
import { isSavedAnswer } from '../../src/pwa/savedAnswers';

// PT-221: the service worker answered an API read from its saved copy once the network took 3 s.
// A live update's read on a slow connection then brought the copy from before the change, and
// nothing read again, so the change never showed.

// The expiration plugin keeps its dates in IndexedDB, which the test environment lacks.
vi.mock('workbox-expiration', () => ({ ExpirationPlugin: class {} }));

const URL_READ = 'http://localhost:5173/api/chats/c-1';

class ExtendableEvent {
  waitUntil(): void {}
}

function memoryCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const urlOf = (request: Request | string) =>
    typeof request === 'string' ? request : request.url;
  const open = (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return Promise.resolve({
      match: (request: Request | string) => Promise.resolve(store.get(urlOf(request))?.clone()),
      put: (request: Request | string, response: Response) =>
        Promise.resolve(void store.set(urlOf(request), response)),
    });
  };
  const match = (request: Request | string) =>
    Promise.resolve(
      [...stores.values()]
        .find((store) => store.has(urlOf(request)))
        ?.get(urlOf(request))
        ?.clone(),
    );
  return { open, match };
}

const answer = (body: unknown) =>
  Response.json(body, { headers: { date: new Date().toUTCString() } });

// The answer, once the worker has also saved it.
async function read(): Promise<Response> {
  const event = new ExtendableEvent();
  const [response, saved] = apiReadStrategy().handleAll({ request: new Request(URL_READ), event });
  await saved;
  return response;
}

beforeEach(() => {
  vi.stubGlobal('self', globalThis);
  vi.stubGlobal('__WB_DISABLE_DEV_LOGS', true);
  vi.stubGlobal('ExtendableEvent', ExtendableEvent);
  vi.stubGlobal('FetchEvent', class extends ExtendableEvent {});
  vi.stubGlobal('caches', memoryCaches());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function saveCopy(): Promise<void> {
  vi.stubGlobal('fetch', () => Promise.resolve(answer({ title: 'before' })));
  await read();
}

it('waits for a slow answer from the tracker instead of answering with the saved copy', async () => {
  await saveCopy();
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    () => new Promise((resolve) => setTimeout(() => resolve(answer({ title: 'after' })), 10_000)),
  );

  const reading = read();
  await vi.runAllTimersAsync();
  const response = await reading;

  expect(isSavedAnswer(response)).toBe(false);
  expect(await response.json()).toEqual({ title: 'after' });
});

it('still answers with the saved copy when the tracker gets no request through', async () => {
  await saveCopy();
  vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));

  const response = await read();

  expect(isSavedAnswer(response)).toBe(true);
  expect(await response.json()).toEqual({ title: 'before' });
});
