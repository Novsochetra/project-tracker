import { TrackerClient } from '@tracker/client';
import type { TicketDetail, UpdateTicketInput } from '@tracker/shared';
import { isSavedApiRead } from '../../src/pwa/apiReadRoute';
import { savedAnswerPlugin } from '../../src/pwa/savedAnswerPlugin';

const ORIGIN = 'http://localhost:5173';

// How the tracker answers fresh reads on one page: it answers, its answer is still on its way
// when the page goes (a reload), or it can't be reached.
export type FreshReads = 'answer' | 'hold' | 'fail';

const withChanges = (detail: TicketDetail, changes: UpdateTicketInput): TicketDetail => ({
  ...detail,
  ticket: { ...detail.ticket, ...changes },
});

// The tracker behind a connection where reads take longer than the service worker's 3 s. A read
// its route takes gets the copy it saved before the test began, as the real route and plugin
// decide, because the tracker's answers that would replace it arrive after the test. A fresh
// read gets nothing from that copy and waits for the tracker. Writes are quick.
export function slowReads(initial: TicketDetail) {
  let tracker = initial;
  const read = async (request: Request, fresh: FreshReads): Promise<Response> => {
    const url = new URL(request.url);
    if (!isSavedApiRead({ url, request, sameOrigin: url.origin === ORIGIN })) {
      return Response.json(tracker);
    }
    const saved = await savedAnswerPlugin.cachedResponseWillBeUsed({
      request,
      cachedResponse: Response.json(initial),
    });
    if (saved) return saved;
    if (fresh === 'fail') throw new TypeError('Failed to fetch');
    return fresh === 'hold' ? new Promise<Response>(() => undefined) : Response.json(tracker);
  };
  const page = (fresh: FreshReads) => {
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.method === 'GET') return read(request, fresh);
      tracker = withChanges(tracker, (await request.json()) as UpdateTicketInput);
      return Response.json(tracker.ticket);
    };
    const client = new TrackerClient({ baseUrl: ORIGIN, fetch });
    return { getTicket: client.getTicket, updateTicket: client.updateTicket };
  };
  return {
    page,
    tracker: () => tracker,
    // Someone else, such as an agent, changes the ticket.
    edit: (changes: UpdateTicketInput) => {
      tracker = withChanges(tracker, changes);
    },
  };
}
