// With its extension, because vite.config.ts loads this file too.
import type { RouteRequest } from './apiReadRoute.ts';

// Workbox copies these into sw.js as source text, so they can't use anything from outside
// themselves. A ranged read (how browsers play video) goes to the network: a cached whole file
// is the wrong answer to it, and iOS doesn't play video without real ranges.
export const isCachedAttachmentFile = ({ url, request, sameOrigin }: RouteRequest): boolean =>
  sameOrigin &&
  /^\/api\/attachments\/[^/]+\/file$/.test(url.pathname) &&
  !request.headers.has('range');

export const attachmentCachePlugin = {
  // A whole video can be 100 MB, so videos never go in the cache.
  cacheWillUpdate: ({ response }: { request: Request; response: Response }) =>
    Promise.resolve(
      response.status === 200 && !response.headers.get('content-type')?.startsWith('video/')
        ? response
        : null,
    ),
};
