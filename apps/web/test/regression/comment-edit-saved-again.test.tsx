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

function open() {
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  const rendered = renderTicket({ detail: server.detail, client: server.client });
  cleanups.push(rendered.restorePhone);
  return server;
}

type Saved = ReturnType<FakeTicketServer['client']['updateComment']>;

// Like the tracker: a save typed over other text than the comment has now is refused.
function refusesStale(server: FakeTicketServer, save: () => Saved, expected?: { text: string }) {
  if (expected && expected.text !== server.detail.activity[0]?.text) return Promise.reject(STALE);
  return save();
}

// Saves the edit, types more while that save is on its way and saves again.
async function saveTwice() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  const editor = screen.getByLabelText('Edit comment');
  await user.type(editor, ', mine');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await user.type(editor, ' and more');
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

async function expectSaved(server: FakeTicketServer) {
  await waitFor(() => expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument());
  expect(server.detail.activity[0]?.text).toBe('First thought, mine and more');
  expect(screen.queryByText(CHANGED_NOTE)).not.toBeInTheDocument();
  expect(storedDraft(ID)).toBeUndefined();
}

// Reviewer 96 (PT-105): the second save landed while the first still hung. The first, refused late
// as typed over older text, kept the edit again and reopened its editor saying the comment changed
// elsewhere, though the tracker had exactly that text.
it('lets a save refused late go when a later save of the edit landed', async () => {
  const server = open();
  const first = deferred<never>();
  server.client.updateComment.mockImplementationOnce(() => first.promise);
  await saveTwice();
  await waitFor(() => expect(server.detail.activity[0]?.text).toBe('First thought, mine and more'));

  await act(async () => {
    first.reject(STALE);
    await first.promise.catch(() => undefined);
  });
  await expectSaved(server);
});

// The usual order: the first save lands first, so the second, typed over the text before it, is
// refused. It said the comment changed elsewhere, though only this edit's own save had changed it.
it('sends a save again when it was refused only because the edit’s earlier save landed', async () => {
  const server = open();
  const plain = server.client.updateComment.getMockImplementation();
  if (!plain) throw new Error('The fake tracker saves comments.');
  const release = deferred<undefined>();
  let firstLanded: Saved | undefined;
  server.client.updateComment
    .mockImplementationOnce((id, input) => {
      firstLanded = release.promise.then(() => plain(id, input));
      return firstLanded;
    })
    .mockImplementationOnce(async (id, input, expected?: { text: string }) => {
      await firstLanded;
      return refusesStale(server, () => plain(id, input), expected);
    });
  await saveTwice();

  release.resolve(undefined);
  await expectSaved(server);
  expect(server.client.updateComment).toHaveBeenLastCalledWith(
    'c1',
    { text: 'First thought, mine and more' },
    { text: 'First thought, mine' },
  );
});
