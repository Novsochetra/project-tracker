// Workbox copies these callbacks into sw.js as source text, so they can't use anything from
// outside themselves; the header is SAVED_ANSWER_HEADER in savedAnswers.ts.
export const savedAnswerPlugin = {
  // A proxy in front of a stopped API answers with a bare 5xx. Failing the request makes
  // NetworkFirst answer from its cache, as it does when the network is down.
  fetchDidSucceed: ({ response }: { response: Response }) => {
    const fromApi = response.headers.get('content-type')?.includes('json') ?? false;
    return response.status >= 500 && !fromApi
      ? Promise.reject(new Error(`No answer from the API (${response.status})`))
      : Promise.resolve(response);
  },
  // NetworkFirst reads its cache only when the network failed or took too long.
  cachedResponseWillBeUsed: ({ cachedResponse }: { cachedResponse?: Response }) => {
    if (!cachedResponse) return Promise.resolve(null);
    const headers = new Headers(cachedResponse.headers);
    headers.set('x-tracker-saved', '1');
    const { status, statusText } = cachedResponse;
    return Promise.resolve(new Response(cachedResponse.body, { status, statusText, headers }));
  },
};
