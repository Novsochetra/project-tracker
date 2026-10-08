export interface RouteRequest {
  url: URL;
  request: Request;
  sameOrigin: boolean;
}

// Workbox copies this into sw.js as source text, so it can't use anything from outside itself.
// The SSE stream never ends, so caching it would buffer it forever. Fresh reads are taken too, so
// their answers keep the saved copies current, but savedAnswerPlugin never answers them from the
// cache. Attachment files have their own route (attachmentFileRoute.ts), which leaves the reads
// it doesn't take to the network.
export const isSavedApiRead = ({ url, request, sameOrigin }: RouteRequest): boolean =>
  sameOrigin &&
  url.pathname.startsWith('/api/') &&
  url.pathname !== '/api/events' &&
  !/^\/api\/attachments\/[^/]+\/file$/.test(url.pathname) &&
  !request.headers.get('accept')?.includes('text/event-stream');
