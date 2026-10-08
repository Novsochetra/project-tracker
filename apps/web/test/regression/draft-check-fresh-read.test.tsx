import { screen, waitFor } from '@testing-library/react';
import { TrackerClient } from '@tracker/client';
import type { TicketDetail, UpdateTicketInput } from '@tracker/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { keepDraft, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';
import { isSavedApiRead } from '../../src/pwa/apiReadRoute';
import { savedAnswerPlugin } from '../../src/pwa/savedAnswerPlugin';

const ORIGIN = 'http://localhost:5173';
const BEFORE = makeTicketDetail(listItem(1, STATUS.todo, 0, { description: 'Original desc' }));
const MINE = 'Original desc + mine';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
  // Typed while the tracker couldn't be reached, over the description it had then.
  keepDraft(
    'description:MOB-1',
    { ticketKey: 'MOB-1', field: 'description', text: MINE },
    BEFORE.ticket.description,
  );
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// The tracker after an agent changed the description, behind a connection so slow that the
// service worker gives up on the network and answers its route from its cache, which still has
// the ticket from before the change.
function slowTracker() {
  let detail: TicketDetail = {
    ...BEFORE,
    ticket: { ...BEFORE.ticket, description: 'Agent changed it' },
  };
  const writes: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const route = { url, request, sameOrigin: url.origin === ORIGIN };
    if (request.method === 'GET' && isSavedApiRead(route)) {
      const saved = await savedAnswerPlugin.cachedResponseWillBeUsed({
        request,
        cachedResponse: Response.json(BEFORE),
      });
      if (saved) return saved;
    }
    if (request.method === 'PATCH') {
      writes.push(`${request.method} ${url.pathname}`);
      const input = (await request.json()) as UpdateTicketInput;
      detail = { ...detail, ticket: { ...detail.ticket, ...input } };
      return Response.json(detail.ticket);
    }
    return Response.json(detail);
  };
  const client = new TrackerClient({ baseUrl: ORIGIN, fetch });
  return {
    client: { getTicket: client.getTicket, updateTicket: client.updateTicket },
    writes,
    description: () => detail.ticket.description,
  };
}

function open(tracker: ReturnType<typeof slowTracker>, closed = false) {
  const rendered = renderTicket({
    detail: BEFORE,
    client: tracker.client,
    ...(closed ? { children: <p>Project screen</p> } : {}),
  });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

it('keeps the text of an open ticket when only a cached answer says nothing changed', async () => {
  const tracker = slowTracker();
  const { queryClient } = open(tracker);
  expect(
    await screen.findByText("Description changed elsewhere while yours wasn't saved."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Description')).toHaveValue(MINE);
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  expect(tracker.writes).toEqual([]);
  expect(tracker.description()).toBe('Agent changed it');
  expect(storedDraft('description:MOB-1')?.text).toBe(MINE);
});

it('keeps the text of a closed ticket and says so when only a cached answer says nothing changed', async () => {
  const tracker = slowTracker();
  const { queryClient } = open(tracker, true);
  expect(
    await screen.findByText("Your edit to MOB-1 isn't saved: it changed elsewhere."),
  ).toBeInTheDocument();
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));
  expect(tracker.writes).toEqual([]);
  expect(tracker.description()).toBe('Agent changed it');
  expect(storedDraft('description:MOB-1')?.text).toBe(MINE);
});
