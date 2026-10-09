import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
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

// The edit's save hangs until `refuse`, as when another tab's edit reaches the tracker first.
function openWithHangingEditSave() {
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  const answer = deferred<never>();
  server.client.updateComment.mockImplementationOnce(() => answer.promise);
  const rendered = renderTicket({ detail: server.detail, client: server.client });
  cleanups.push(rendered.restorePhone);
  const refuse = () =>
    act(async () => {
      answer.reject(STALE);
      await answer.promise.catch(() => undefined);
    });
  return { server, refuse };
}

// Reviewer 84 (PT-105): text typed in the editor while the edit's save was on its way was kept,
// but the 409 for that save kept the older, sent text over it, and said nothing while the editor
// was open: a reload or a closed page brought back the sent text, and what was typed after it
// was lost.
it('keeps text typed while a refused edit was on its way, and says the comment changed', async () => {
  const user = userEvent.setup();
  const { server, refuse } = openWithHangingEditSave();
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  const editor = screen.getByLabelText('Edit comment');
  await user.type(editor, ', mine');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await user.type(editor, ' and more');
  expect(storedDraft(ID)?.text).toBe('First thought, mine and more');

  await refuse();
  expect(await screen.findByText(CHANGED_NOTE)).toBeInTheDocument();
  expect(editor).toHaveValue('First thought, mine and more');
  expect(storedDraft(ID)?.text).toBe('First thought, mine and more');
  // Not sent for the user: they decide, with the note in view.
  expect(storedDraft(ID)?.submitted).toBeUndefined();
  expect(server.client.updateComment).toHaveBeenCalledTimes(1);
});
