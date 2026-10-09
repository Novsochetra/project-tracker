import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'comment-edit:c1';
const CHANGED_NOTE = "The comment changed elsewhere while your edit wasn't saved.";
const STALE = new ApiError(409, 'stale', 'The comment changed since this edit was typed.');

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function open(server: FakeTicketServer) {
  const rendered = renderTicket({ detail: server.detail, client: server.client });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

// The first save of the edit hangs until `refuse`; later saves reach the tracker.
function startHanging() {
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  const answer = deferred<never>();
  server.client.updateComment.mockImplementationOnce(() => answer.promise);
  const refuse = () =>
    act(async () => {
      answer.reject(STALE);
      await answer.promise.catch(() => undefined);
    });
  return { server, refuse };
}

async function saveEdit(user: ReturnType<typeof userEvent.setup>, typed: string) {
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), typed);
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

// Reviewer 96 (PT-105): the ticket was left while an edit's save hung and opened again, where the
// app's retry saved the edit and the user edited the comment again. The first save, refused late as
// typed over older text, still kept the gone editor's text over the text typed since: a reload
// lost it, while the open editor showed it with no note.
it('keeps text typed in an editor opened again when the first save is refused late', async () => {
  const user = userEvent.setup();
  const { server, refuse } = startHanging();
  const first = open(server);
  await saveEdit(user, ', mine');
  first.unmount();

  open(server);
  await waitFor(() => expect(server.detail.activity[0]?.text).toBe('First thought, mine'));
  expect(await screen.findByRole('button', { name: 'Comment options' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ' and more');
  expect(storedDraft(ID)?.text).toBe('First thought, mine and more');

  await refuse();
  expect(storedDraft(ID)?.text).toBe('First thought, mine and more');
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought, mine and more');
  expect(screen.queryByText(CHANGED_NOTE)).not.toBeInTheDocument();
});

// The same when someone else edited the comment while the first save hung: the editor opened again
// says so, and what the user types there is kept.
it('keeps text typed under the note in an editor opened again', async () => {
  const user = userEvent.setup();
  const { server, refuse } = startHanging();
  const first = open(server);
  await saveEdit(user, ', mine');
  first.unmount();
  await server.client.updateComment('c1', { text: 'First thought, by an agent' });

  open(server);
  expect(await screen.findByText(CHANGED_NOTE)).toBeInTheDocument();
  await user.type(screen.getByLabelText('Edit comment'), ' and more');
  expect(storedDraft(ID)?.text).toBe('First thought, mine and more');

  await refuse();
  expect(storedDraft(ID)).toMatchObject({ text: 'First thought, mine and more', changed: true });
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought, mine and more');
  expect(server.detail.activity[0]?.text).toBe('First thought, by an agent');
});
