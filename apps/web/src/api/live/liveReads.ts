// The service worker waits for the tracker on a read with this header, instead of answering with
// its saved copy after 3 s (pwa/apiReadStrategy.ts): that copy can't hold the change a live update
// told of (test/regression/sw-slow-read-not-saved).
export const LIVE_READ_HEADER = 'x-tracker-live';

let starting = 0;

// TanStack Query calls a query's function within invalidateQueries, and each one calls fetch
// before its first await, so the reads started here are the ones fetch sees meanwhile. A retry or
// a fallback after an await goes out as an ordinary read.
export function startLiveReads<T>(start: () => T): T {
  starting += 1;
  try {
    return start();
  } finally {
    starting -= 1;
  }
}

const urlOf = (input: RequestInfo | URL): string =>
  input instanceof Request ? input.url : input instanceof URL ? input.href : input;

function isApiRead(input: RequestInfo | URL, init: RequestInit | undefined): boolean {
  const request = input instanceof Request ? input : null;
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  const url = new URL(urlOf(input), window.location.href);
  return method === 'GET' && url.pathname.startsWith('/api/');
}

function tagged(input: RequestInfo | URL, init: RequestInit | undefined): RequestInit {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
  headers.set(LIVE_READ_HEADER, '1');
  return { ...init, headers };
}

export function tagLiveReads(scope: { fetch: typeof fetch }): () => void {
  const fetchRead = scope.fetch;
  scope.fetch = (input, init) =>
    fetchRead.call(
      scope,
      input,
      starting > 0 && isApiRead(input, init) ? tagged(input, init) : init,
    );
  return () => {
    scope.fetch = fetchRead;
  };
}
