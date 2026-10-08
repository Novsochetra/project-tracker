import { TrackerClient } from '@tracker/client';
import { expect, it } from 'vitest';
import { isSavedApiRead } from '../../src/pwa/apiReadRoute';
import { savedAnswerPlugin } from '../../src/pwa/savedAnswerPlugin';

const ORIGIN = 'http://localhost:5173';

// The request the client puts on the wire, as the service worker's router sees it.
async function sent(read: (client: TrackerClient) => Promise<unknown>): Promise<Request> {
  const requests: Request[] = [];
  const client = new TrackerClient({
    baseUrl: ORIGIN,
    fetch: (input, init) => {
      requests.push(new Request(input, init));
      return Promise.resolve(Response.json({}));
    },
  });
  await read(client);
  const [request] = requests;
  if (!request) throw new Error('The client sent nothing.');
  return request;
}

// The service worker answers a read from its cache only when its route takes the read and the
// saved-answer plugin hands the cached answer out.
const answeredFromCache = async (request: Request) =>
  isSavedApiRead({ url: new URL(request.url), request, sameOrigin: true }) &&
  (await savedAnswerPlugin.cachedResponseWillBeUsed({
    request,
    cachedResponse: Response.json({}),
  })) !== null;

// On a slow connection the service worker answered the drafts' conflict check from its cache
// after 3 s, so the check saw the value from before an agent's change and the retry overwrote it.
it('lets the service worker answer ordinary reads from its cache, but never a fresh read', async () => {
  expect(await answeredFromCache(await sent((client) => client.getTicket('MOB-1')))).toBe(true);
  expect(
    await answeredFromCache(await sent((client) => client.getTicket('MOB-1', { fresh: true }))),
  ).toBe(false);
  expect(
    await answeredFromCache(
      await sent((client) => client.listTickets('MOB', { q: 'login' }, { fresh: true })),
    ),
  ).toBe(false);
});

it('keeps a fresh read out of the browser cache too', async () => {
  const request = await sent((client) => client.getTicket('MOB-1', { fresh: true }));
  expect(request.cache).toBe('no-store');
});
