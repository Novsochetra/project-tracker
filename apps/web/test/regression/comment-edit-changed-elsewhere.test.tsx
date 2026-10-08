import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { keepDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const CHANGED_NOTE = "The comment changed elsewhere while your edit wasn't saved.";

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

// An agent rewrites the comment through the tracker, not through this screen.
async function agentRewrites(server: FakeTicketServer, text: string) {
  await server.client.updateComment('c1', { text });
  server.client.updateComment.mockClear();
}

const serverComment = (server: FakeTicketServer) => server.detail.activity[0]?.text;

// Seen in both browsers: an edit typed in an earlier visit and never saved opened again with no
// note, although an agent had rewritten the comment meanwhile, and Save put it over the agent's
// text without a word.
it('checks an edit kept from an earlier visit before Save sends it', async () => {
  const user = userEvent.setup();
  keepDraft(
    'comment-edit:c1',
    { ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'c1', text: 'First thought, mine' },
    'First thought',
  );
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  await agentRewrites(server, 'Agent rewrote it');
  open(server);
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought, mine');

  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(CHANGED_NOTE)).toBeInTheDocument();
  expect(server.client.updateComment).not.toHaveBeenCalled();
  expect(serverComment(server)).toBe('Agent rewrote it');

  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(serverComment(server)).toBe('First thought, mine'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
});

it('saves an edit kept from an earlier visit when the comment still reads as it did', async () => {
  const user = userEvent.setup();
  keepDraft(
    'comment-edit:c1',
    { ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'c1', text: 'First thought, mine' },
    'First thought',
  );
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  open(server);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument());
  const log = screen.getByRole('region', { name: 'Activity' });
  expect(within(log).getByText('First thought, mine')).toBeInTheDocument();
  expect(serverComment(server)).toBe('First thought, mine');
  expect(hasDrafts()).toBe(false);
});

// The same for an edit whose Save failed: pressing Save again sent it over a change made while
// the tracker couldn't be reached.
it('checks an edit whose Save failed before Save sends it again', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  open(server);
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ', mine');
  server.setReachable(false);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText("Your edit isn't saved yet.")).toBeInTheDocument();
  server.setReachable(true);
  await agentRewrites(server, 'Agent rewrote it');

  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(CHANGED_NOTE)).toBeInTheDocument();
  expect(server.client.updateComment).not.toHaveBeenCalled();
  expect(serverComment(server)).toBe('Agent rewrote it');
});
