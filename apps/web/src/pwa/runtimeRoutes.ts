import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { isSavedApiRead } from './apiReadRoute';
import { attachmentCachePlugin, isCachedAttachmentFile } from './attachmentFileRoute';
import { API_CACHE, ATTACHMENT_CACHE } from './cacheNames';
import { savedAnswerPlugin } from './savedAnswerPlugin';

const DAY_SECONDS = 24 * 60 * 60;

// Routes only match GET, so writes always go straight to the network.
export function registerRuntimeRoutes(): void {
  registerRoute(
    isCachedAttachmentFile,
    new CacheFirst({
      cacheName: ATTACHMENT_CACHE,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * DAY_SECONDS,
          purgeOnQuotaError: true,
        }),
        attachmentCachePlugin,
      ],
    }),
    'GET',
  );
  registerRoute(
    isSavedApiRead,
    new NetworkFirst({
      cacheName: API_CACHE,
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * DAY_SECONDS }),
        // Last, so it marks only cached answers that are still fresh enough to use.
        savedAnswerPlugin,
      ],
    }),
    'GET',
  );
}
