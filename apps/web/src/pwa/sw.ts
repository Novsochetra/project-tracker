import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { listenForPushes } from './push/pushEvents';
import type { PushScope } from './push/workerTypes';
import { registerRuntimeRoutes } from './runtimeRoutes';

declare const self: PushScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
  skipWaiting: () => Promise<void>;
};

// A new build takes over at once; the page reloads when it is safe (reloadWhenSafe).
void self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(?:\/|$)/],
  }),
);
registerRuntimeRoutes();
listenForPushes(self);
