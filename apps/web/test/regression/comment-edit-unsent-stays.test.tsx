import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
import {
  renderTicket,
  type RenderTicketOptions,
} from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function open(server: FakeTicketServer, options: RenderTicketOptions = {}) {
  const rendered = renderTicket({ detail: server.detail, client: server.client, ...options });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

async function typeAnEditAndLeave() {
  const user = userEvent.setup();
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  const first = open(server);
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ' half-written');
  first.unmount();
  expect(hasDrafts()).toBe(true);
  return { user, server };
}

// Requests answer within 5 ms, so 50 ms lets the sync and whatever it starts settle.
async function letDraftsSync() {
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
}

// Typing in a comment's editor and leaving with Back published the edit as soon as the ticket
// opened again, or at the next start for a closed ticket, as if its Save had failed.
it('reopens an edit nobody saved in its editor and sends it only on Save', async () => {
  const { user, server } = await typeAnEditAndLeave();
  open(server);
  const editor = screen.getByLabelText('Edit comment');
  expect(editor).toHaveValue('First thought half-written');
  expect(editor).not.toHaveFocus();
  expect(screen.queryByText(/isn't saved yet/)).not.toBeInTheDocument();
  await letDraftsSync();
  expect(server.client.updateComment).not.toHaveBeenCalled();
  expect(server.detail.activity[0]?.text).toBe('First thought');

  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument());
  const log = screen.getByRole('region', { name: 'Activity' });
  expect(within(log).getByText('First thought half-written')).toBeInTheDocument();
  expect(server.detail.activity[0]?.text).toBe('First thought half-written');
  expect(hasDrafts()).toBe(false);
});

it('never sends an edit nobody saved from a closed ticket', async () => {
  const { server } = await typeAnEditAndLeave();
  open(server, { children: <p>Project screen</p> });
  await letDraftsSync();
  // It reads the ticket, to drop the edit if its comment was deleted.
  expect(server.client.getTicket).toHaveBeenCalledWith('MOB-1', { fresh: true });
  expect(server.client.updateComment).not.toHaveBeenCalled();
  expect(server.detail.activity[0]?.text).toBe('First thought');
  expect(storedDraft('comment-edit:c1')?.text).toBe('First thought half-written');
});
