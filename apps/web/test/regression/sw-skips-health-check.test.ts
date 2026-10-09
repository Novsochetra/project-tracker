import { TrackerClient } from '@tracker/client';
import { expect, it } from 'vitest';
import { isSavedApiRead } from '../../src/pwa/apiReadRoute';
import { isCachedAttachmentFile } from '../../src/pwa/attachmentFileRoute';

// The service worker fetched GET /api/health for the page. A check the page stopped after 3 s
// stopped waiting, but the worker's own request stayed open until the connection closed, about
// 80 s later (PT-109 review). A request no route takes is the browser's own, and ends when the
// page stops it.

const ORIGIN = 'http://localhost:5173';

async function sentByCheckHealth(): Promise<Request> {
  const requests: Request[] = [];
  const client = new TrackerClient({
    baseUrl: ORIGIN,
    fetch: (input, init) => {
      requests.push(new Request(input, init));
      return Promise.resolve(Response.json({ ok: true }));
    },
  });
  await client.checkHealth({ signal: new AbortController().signal });
  const [request] = requests;
  if (!request) throw new Error('The client sent nothing.');
  return request;
}

it('leaves the health check to the network: no service worker route takes it', async () => {
  const request = await sentByCheckHealth();
  const route = { url: new URL(request.url), request, sameOrigin: true };

  expect(route.url.pathname).toBe('/api/health');
  expect(isSavedApiRead(route)).toBe(false);
  expect(isCachedAttachmentFile(route)).toBe(false);
});
