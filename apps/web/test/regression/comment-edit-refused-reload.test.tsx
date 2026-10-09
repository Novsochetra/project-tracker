import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'comment-edit:c1';
const CHANGED_NOTE = "The comment changed elsewhere while your edit wasn't saved.";
const THEIRS = 'First thought, from tab B';

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

// Tab B's edit reaches the tracker first, so this tab's is refused as typed over older text.
function tabBSavesFirst(server: FakeTicketServer) {
  server.client.updateComment.mockImplementationOnce(async (activityId: string) => {
    await server.client.updateComment(activityId, { text: THEIRS });
    throw new ApiError(409, 'stale', 'The comment changed since this edit was typed.');
  });
}

// Tab B, with memory of its own, hears its save landed: the tracker has its text now.
async function tabBSettles() {
  vi.resetModules();
  const tabB = await import('../../src/lib/storedDrafts');
  act(() => {
    tabB.draftSaved(ID, THEIRS);
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
}

// PT-111 (from PT-105's review): two tabs edited one comment and this tab's edit was refused.
// Tab B's save, settling after that, moved the kept edit's base to B's text. After a reload the
// edit reopened with no note, and Save checked it against B's text, found it unchanged and put
// this tab's text over B's without a word.
it('reopens a refused edit with its note after a reload, so Save never replaces theirs unseen', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  tabBSavesFirst(server);
  const first = open(server);
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ', mine');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(CHANGED_NOTE)).toBeInTheDocument();
  await tabBSettles();

  first.unmount();
  open(server);
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought, mine');
  expect(await screen.findByText(CHANGED_NOTE)).toBeInTheDocument();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(server.detail.activity[0]?.text).toBe(THEIRS);

  // With the note in view, Save replaces theirs.
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(server.detail.activity[0]?.text).toBe('First thought, mine'));
  expect(server.client.updateComment).toHaveBeenLastCalledWith(
    'c1',
    { text: 'First thought, mine' },
    { text: THEIRS },
  );
});
