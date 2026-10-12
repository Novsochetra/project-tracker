import { act, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { listItem, makeBoard, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { RETRY_GAP_MS, useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { guardUnload, hasDrafts } from '../../src/lib/drafts';
import { keepDraft, storedDrafts } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

function Drafts() {
  useTicketDrafts(true);
  return null;
}

const DELETED = new ApiError(404, 'not_found', 'Ticket MOB-8 not found');

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

// Unsent text in MOB-8, which someone else then deleted.
const keepComment = () =>
  keepDraft('comment:MOB-8', { ticketKey: 'MOB-8', field: 'comment', text: 'Unsent words' }, '');

const keepUnsentEdit = () =>
  keepDraft(
    'comment-edit:c8',
    { ticketKey: 'MOB-8', field: 'comment-edit', activityId: 'c8', text: 'Half an edit' },
    'An old comment',
  );

function syncDrafts() {
  const api = setupApi({ getTicket: vi.fn().mockRejectedValue(DELETED) });
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  return api.client;
}

afterEach(() => {
  cleanups.forEach((undo) => undo());
  vi.restoreAllMocks();
});

const asksBeforeUnload = () => {
  const stop = guardUnload();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  stop();
  return event.defaultPrevented;
};

// Text in the comment box of a ticket deleted elsewhere was never removed, because the app-wide
// sync never looked at tickets with only a comment box draft: every reload asked first, app
// updates waited, and opening the ticket just went back to its project.
it('removes the comment box text of a ticket deleted elsewhere once the tracker says it is gone', async () => {
  keepComment();
  expect(asksBeforeUnload()).toBe(true);
  const client = syncDrafts();
  await waitFor(() => expect(storedDrafts()).toEqual([]));
  expect(client.getTicket).toHaveBeenCalledWith('MOB-8', { fresh: true });
  expect(hasDrafts()).toBe(false);
  expect(asksBeforeUnload()).toBe(false);
});

it('removes an edit nobody saved in a ticket deleted elsewhere', async () => {
  keepUnsentEdit();
  syncDrafts();
  await waitFor(() => expect(storedDrafts()).toEqual([]));
  expect(hasDrafts()).toBe(false);
});

it('removes the comment box text of a ticket deleted while the app is online, after the change is reported', async () => {
  vi.useFakeTimers();
  cleanups.push(() => vi.useRealTimers());
  keepComment();
  const getTicket = vi.fn().mockResolvedValue(makeTicketDetail(listItem(8, STATUS.todo, 0)));
  const api = setupApi({ getTicket });
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(getTicket).toHaveBeenCalledTimes(1);
  expect(hasDrafts()).toBe(true);

  // An agent deletes MOB-8; the live update refreshes the project's queries.
  getTicket.mockRejectedValue(DELETED);
  await act(() => api.queryClient.invalidateQueries({ queryKey: queryKeys.project('MOB') }));
  await act(() => vi.advanceTimersByTimeAsync(RETRY_GAP_MS));
  expect(getTicket).toHaveBeenCalledTimes(2);
  expect(storedDrafts()).toEqual([]);
  expect(asksBeforeUnload()).toBe(false);
});

it('removes the drafts of a deleted ticket when it is opened', async () => {
  keepComment();
  keepUnsentEdit();
  const rendered = renderTicket({
    detail: makeTicketDetail(listItem(8, STATUS.todo, 0)),
    seed: false,
    client: { getTicket: vi.fn().mockRejectedValue(DELETED) },
  });
  cleanups.push(rendered.restorePhone);
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/p\/MOB$/));
  expect(storedDrafts()).toEqual([]);
  expect(hasDrafts()).toBe(false);
});
