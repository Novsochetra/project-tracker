export interface RouteRequest {
  url: URL;
  request: Request;
  sameOrigin: boolean;
}

// Workbox copies this into sw.js as source text, so it can't use anything from outside itself;
// the header is FRESH_READ_HEADER in @tracker/client. The SSE stream never ends, so caching it
// would buffer it forever, and a fresh read must reach the tracker or fail.
export const isSavedApiRead = ({ url, request, sameOrigin }: RouteRequest): boolean =>
  sameOrigin &&
  url.pathname.startsWith('/api/') &&
  url.pathname !== '/api/events' &&
  !request.headers.get('accept')?.includes('text/event-stream') &&
  !request.headers.has('x-tracker-fresh');
