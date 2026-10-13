export interface RouteRequest {
  url: URL;
  request: Request;
  sameOrigin: boolean;
}

// The SSE stream never ends, so caching it would buffer it forever. The health check goes to the
// network as the page's own request: the page stops a check after 3 s, but the worker's fetch for
// it stayed open until the connection closed (PT-113). Fresh reads are taken too, so their
// answers keep the saved copies current, but savedAnswerPlugin never answers them from the cache.
// Attachment files have their own route (attachmentFileRoute.ts), which leaves the reads it
// doesn't take to the network.
export const isSavedApiRead = ({ url, request, sameOrigin }: RouteRequest): boolean =>
  sameOrigin &&
  url.pathname.startsWith('/api/') &&
  url.pathname !== '/api/events' &&
  url.pathname !== '/api/health' &&
  !/^\/api\/attachments\/[^/]+\/file$/.test(url.pathname) &&
  !request.headers.get('accept')?.includes('text/event-stream');
