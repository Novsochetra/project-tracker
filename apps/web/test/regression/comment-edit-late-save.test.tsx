import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  goOffline,
  goOnline,
  restoreOnLine,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { keepDraft, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const CHANGED_NOTE = "The comment changed elsewhere while your edit wasn't saved.";
const STALE_MESSAGE = 'The comment changed since this edit was typed. Read it again first.';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations(), restoreOnLine];
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

async function edit(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), text);
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

// Another tab saved its edit first: the tracker refuses this one, as it would an older save. That
// tab's edit is still in the shared drafts store, as when its answer comes after this one's.
function tabBSavedFirst(server: FakeTicketServer) {
  server.client.updateComment.mockImplementationOnce(async (activityId: string) => {
    const theirs = 'First thought, from tab B';
    keepDraft(
      'comment-edit:c1',
      { ticketKey: 'MOB-1', field: 'comment-edit', activityId, text: theirs, submitted: true },
      'First thought',
    );
    await server.client.updateComment(activityId, { text: theirs });
    throw new ApiError(409, 'stale', STALE_MESSAGE);
  });
}

// Reviewer 77 (PT-90): an edit said nothing about the text it was typed over, so tab A's edit save
// that hung and landed late overwrote tab B's newer edit.
it('says what an edit was typed over', async () => {
  const server = open();
  await edit(', mine');
  await waitFor(() =>
    expect(server.client.updateComment).toHaveBeenCalledWith(
      'c1',
      { text: 'First thought, mine' },
      { text: 'First thought' },
    ),
  );
});

it('keeps an edit the tracker refused as late, and asks which text to keep', async () => {
  const server = open();
  tabBSavedFirst(server);
  await edit(', mine');

  expect(await screen.findByText(CHANGED_NOTE)).toBeInTheDocument();
  expect(screen.queryByText(STALE_MESSAGE)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought, mine');
  expect(server.detail.activity[0]?.text).toBe('First thought, from tab B');
  // Kept for a reload, but not sent for the user: Save pressed again replaces theirs.
  expect(storedDraft('comment-edit:c1')).toMatchObject({ text: 'First thought, mine' });
  expect(storedDraft('comment-edit:c1')?.submitted).toBeUndefined();

  await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(server.detail.activity[0]?.text).toBe('First thought, mine'));
  expect(server.client.updateComment).toHaveBeenLastCalledWith(
    'c1',
    { text: 'First thought, mine' },
    { text: 'First thought, from tab B' },
  );
});

it('says what an edit was typed over when the app sends it again', async () => {
  const server = open();
  goOffline(server);
  await edit(', mine');
  expect(await screen.findByText("Your edit isn't saved yet.")).toBeInTheDocument();
  server.client.updateComment.mockClear();

  goOnline(server);
  await waitFor(() => expect(server.detail.activity[0]?.text).toBe('First thought, mine'));
  expect(server.client.updateComment).toHaveBeenCalledWith(
    'c1',
    { text: 'First thought, mine' },
    { text: 'First thought' },
  );
});
