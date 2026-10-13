import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { isSavedApiRead } from './apiReadRoute';
import { apiReadStrategy } from './apiReadStrategy';
import { attachmentCachePlugin, isCachedAttachmentFile } from './attachmentFileRoute';
import { ATTACHMENT_CACHE } from './cacheNames';

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
  registerRoute(isSavedApiRead, apiReadStrategy(), 'GET');
}
