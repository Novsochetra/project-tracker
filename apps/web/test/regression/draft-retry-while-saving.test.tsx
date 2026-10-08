import { act, screen, waitFor } from '@testing-library/react';
import type { TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { keepDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// The first read, the check of the retry the field starts as it opens, waits for the test. A
// second check reads the ticket as it was before that retry's save, like a read the tracker
// answers before the save reaches it.
function slowFirstRead(server: FakeTicketServer) {
  const read = deferred<TicketDetail>();
  const before = server.detail;
  const getTicket = vi.fn().mockReturnValueOnce(read.promise).mockResolvedValueOnce(before);
  getTicket.mockImplementation(server.client.getTicket);
  // Lets the check's answer through, then has the app-wide sync ask the drafts on screen to
  // retry before the screen renders again, as when the sync starts while that retry is saving.
  const answerThenSyncAgain = () =>
    act(async () => {
      read.resolve(before);
      await new Promise((resolve) => setTimeout(resolve, 0));
      window.dispatchEvent(new Event('online'));
    });
  return { getTicket, answerThenSyncAgain };
}

// The app-wide sync asked the field again after the field's own check and before its save showed
// on screen, so a second check and a second identical save went out.
it('retries a field draft kept from an earlier visit once', async () => {
  keepDraft(
    'description:MOB-1',
    { ticketKey: 'MOB-1', field: 'description', text: 'Steps typed earlier' },
    '',
  );
  const server = fakeTicketServer(makeTicketDetail());
  const { getTicket, answerThenSyncAgain } = slowFirstRead(server);
  const rendered = renderTicket({ detail: server.detail, client: { ...server.client, getTicket } });
  cleanups.push(rendered.restorePhone);
  await answerThenSyncAgain();
  await waitFor(() => expect(server.detail.ticket.description).toBe('Steps typed earlier'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(server.client.updateTicket).toHaveBeenCalledTimes(1);
});

// A comment edit's retry already looked at the edit again after its check and sent it once; this
// keeps it that way.
it('retries a comment edit whose Save failed in an earlier visit once', async () => {
  keepDraft(
    'comment-edit:c1',
    {
      ticketKey: 'MOB-1',
      field: 'comment-edit',
      activityId: 'c1',
      text: 'First thought, edited',
      submitted: true,
    },
    'First thought',
  );
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  const { getTicket, answerThenSyncAgain } = slowFirstRead(server);
  const rendered = renderTicket({ detail: server.detail, client: { ...server.client, getTicket } });
  cleanups.push(rendered.restorePhone);
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought, edited');
  await answerThenSyncAgain();
  await waitFor(() => expect(server.detail.activity[0]?.text).toBe('First thought, edited'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(server.client.updateComment).toHaveBeenCalledTimes(1);
});
