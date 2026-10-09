import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UpdateTicketInput } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { storedDrafts } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const NOTE = "Title isn't saved yet.";

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Each save waits for the test to answer it; reads answer with what the tracker has.
function openWithHeldSaves() {
  const server = fakeTicketServer(makeTicketDetail());
  const saves: Array<Deferred<unknown>> = [];
  const updateTicket = vi.fn((key: string, input: UpdateTicketInput): Promise<unknown> => {
    const save = deferred<unknown>();
    saves.push(save);
    return save.promise.then(() => server.client.updateTicket(key, input));
  });
  const rendered = renderTicket({
    detail: server.detail,
    client: { ...server.client, updateTicket },
  });
  cleanups.push(rendered.restorePhone);
  const answer = (index: number, how: 'land' | 'fail') =>
    act(async () => {
      const save = saves[index];
      if (how === 'land') save?.resolve(undefined);
      else save?.reject(new TypeError('Failed to fetch'));
      await save?.promise.catch(() => undefined);
    });
  return { server, updateTicket, answer };
}

// Reviewer 77's jitter spec (PT-105 review, 3 runs in 19 on desktop): the title's save failed,
// its retry sent the text, and more was typed while that save was on its way. Leaving the field
// then asked for a retry, which skipped it because a save was on its way, and once that save of
// the older text landed nothing tried again: the note stayed, and the tracker missed the end.
it('retries a failed field left while its retry’s save is on its way, once that save lands', async () => {
  const user = userEvent.setup();
  const { server, updateTicket, answer } = openWithHeldSaves();
  const title = screen.getByLabelText('Title');
  await user.type(title, ' one');
  await user.click(screen.getByLabelText('Description'));
  await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(1));
  await answer(0, 'fail');
  expect(await screen.findByText(NOTE)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Retry saving title' }));
  await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(2));
  await user.type(title, ' two');
  await user.click(screen.getByLabelText('Description'));

  await answer(1, 'land');
  await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(3));
  expect(updateTicket).toHaveBeenLastCalledWith(
    'MOB-1',
    { title: 'Ticket 1 one two' },
    { title: 'Ticket 1 one' },
  );
  await answer(2, 'land');
  await waitFor(() => expect(screen.queryByText(NOTE)).not.toBeInTheDocument());
  expect(server.detail.ticket.title).toBe('Ticket 1 one two');
  await waitFor(() => expect(storedDrafts()).toEqual([]));
});
