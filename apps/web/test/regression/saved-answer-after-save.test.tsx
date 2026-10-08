import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackerClient } from '@tracker/client';
import type { TicketDetail, UpdateTicketInput } from '@tracker/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { queryKeys } from '../../src/api';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
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
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// The tracker behind a connection where reads take longer than the service worker's 3 s, so for
// a read its route takes it answers from its cache, as the real route and plugin decide, and
// stores the tracker's answer once that arrives. Writes are quick.
function slowReads() {
  let tracker: TicketDetail = BEFORE;
  let savedCopy: TicketDetail = BEFORE;
  const answers: string[] = [];
  const read = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!isSavedApiRead({ url, request, sameOrigin: url.origin === ORIGIN })) {
      answers.push(tracker.ticket.description);
      return Response.json(tracker);
    }
    const saved = await savedAnswerPlugin.cachedResponseWillBeUsed({
      request,
      cachedResponse: Response.json(savedCopy),
    });
    const fromTracker = tracker;
    savedCopy = fromTracker;
    answers.push(
      saved
        ? `saved: ${(await saved.clone().json()).ticket.description}`
        : fromTracker.ticket.description,
    );
    return saved ?? Response.json(fromTracker);
  };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.method === 'GET') return read(request);
    const changes = (await request.json()) as UpdateTicketInput;
    tracker = { ...tracker, ticket: { ...tracker.ticket, ...changes } };
    return Response.json(tracker.ticket);
  };
  const client = new TrackerClient({ baseUrl: ORIGIN, fetch });
  return {
    client: { getTicket: client.getTicket, updateTicket: client.updateTicket },
    answers,
    description: () => tracker.ticket.description,
  };
}

// Seen on a production build with ticket reads delayed 6 s: after the save, the refetch was
// answered from the service worker's copy from before it, so the field went back to the old
// text while the tracker had the new one, and typing over it would have saved over the new text.
it('keeps the saved text on screen when the reads after the save are slow', async () => {
  const user = userEvent.setup();
  const slow = slowReads();
  const { queryClient, restorePhone } = renderTicket({ detail: BEFORE, client: slow.client });
  cleanups.push(restorePhone);
  const field = screen.getByLabelText('Description');
  await user.type(field, ' + mine');
  await user.click(screen.getByLabelText('Title'));
  await waitFor(() => expect(slow.description()).toBe(MINE));
  await waitFor(() => expect(slow.answers.length).toBeGreaterThan(0));
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(field).toHaveValue(MINE);

  // A later refresh, such as a live update's, takes the copy the service worker has by then.
  await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.ticket('MOB-1') }));
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(slow.answers.at(-1)).toBe(`saved: ${MINE}`);
  expect(field).toHaveValue(MINE);
});
