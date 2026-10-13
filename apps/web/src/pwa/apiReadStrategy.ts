import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { RouteHandlerCallback } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { NetworkFirst } from 'workbox-strategies';
import { API_CACHE } from './cacheNames';
import { savedAnswerPlugin } from './savedAnswerPlugin';

const DAY_SECONDS = 24 * 60 * 60;

// Written out rather than imported (LIVE_READ_HEADER in api/live/liveReads.ts), so the service
// worker takes in none of the page's own code.
const LIVE_READ_HEADER = 'x-tracker-live';

const plugins = () => [
  new CacheableResponsePlugin({ statuses: [200] }),
  new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * DAY_SECONDS }),
  // Last, so it marks only cached answers that are still fresh enough to use.
  savedAnswerPlugin,
];

// A screen gets its saved copy after 3 s on a slow or hanging connection. A live update's read
// waits for the tracker instead: the copy can't hold the change the update told of, and nothing
// read again (test/regression/sw-slow-read-not-saved). Both still get the copy when the network
// fails or a proxy answers for a stopped API with a bare 5xx.
export function apiReadHandler(): RouteHandlerCallback {
  const quick = new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 3,
    plugins: plugins(),
  });
  const patient = new NetworkFirst({ cacheName: API_CACHE, plugins: plugins() });
  return (options) =>
    (options.request.headers.has(LIVE_READ_HEADER) ? patient : quick).handle(options);
}
