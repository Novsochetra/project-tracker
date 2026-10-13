import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { NetworkFirst } from 'workbox-strategies';
import { API_CACHE } from './cacheNames';
import { savedAnswerPlugin } from './savedAnswerPlugin';

const DAY_SECONDS = 24 * 60 * 60;

// No timeout: a read that waited 3 s got the copy saved before the change a live update told of,
// and the change never showed (test/regression/sw-slow-read-not-saved). A read the network can't
// carry, or a stopped API's bare 5xx, still gets the saved copy.
export const apiReadStrategy = (): NetworkFirst =>
  new NetworkFirst({
    cacheName: API_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * DAY_SECONDS }),
      // Last, so it marks only cached answers that are still fresh enough to use.
      savedAnswerPlugin,
    ],
  });
