// The headers are written out rather than imported (SAVED_ANSWER_HEADER in savedAnswers.ts), so
// the service worker takes in none of the page's own code.
export const savedAnswerPlugin = {
  // A proxy in front of a stopped API answers with a bare 5xx. Failing the request makes
  // NetworkFirst answer from its cache, as it does when the network is down.
  fetchDidSucceed: ({ response }: { response: Response }) => {
    const fromApi = response.headers.get('content-type')?.includes('json') ?? false;
    return response.status >= 500 && !fromApi
      ? Promise.reject(new Error(`No answer from the API (${response.status})`))
      : Promise.resolve(response);
  },
  // NetworkFirst reads its cache only when the network failed or took too long. A fresh read
  // (FRESH_READ_HEADER in @tracker/client) gets nothing from it, so it waits for the tracker or
  // fails, while its answer still refreshes the cache.
  cachedResponseWillBeUsed: ({
    request,
    cachedResponse,
  }: {
    request?: Request;
    cachedResponse?: Response;
  }) => {
    if (!cachedResponse || request?.headers.has('x-tracker-fresh')) return Promise.resolve(null);
    const headers = new Headers(cachedResponse.headers);
    headers.set('x-tracker-saved', '1');
    const { status, statusText } = cachedResponse;
    return Promise.resolve(new Response(cachedResponse.body, { status, statusText, headers }));
  },
};
