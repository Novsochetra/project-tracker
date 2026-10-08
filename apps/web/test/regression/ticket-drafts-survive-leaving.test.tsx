import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  goOffline,
  goOnline,
  restoreOnLine,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
import {
  renderTicket,
  type RenderTicketOptions,
} from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations(), restoreOnLine];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function open(server: FakeTicketServer, options: RenderTicketOptions = {}) {
  const rendered = renderTicket({ detail: server.detail, client: server.client, ...options });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const withComment = (): TicketDetail =>
  makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] });

const unsavedNotes = () => screen.queryAllByText(/isn't saved yet/);

// The typed text lived only in the screen's state: tapping Back while a save failed, or
// reloading, dropped it, and nothing was saved once the tracker could be reached again.
it('keeps title, description and assignee typed offline through leaving, then saves them online', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(makeTicketDetail());
  goOffline(server);
  const first = open(server);
  await user.type(screen.getByLabelText('Title'), ' on Android');
  await user.type(screen.getByLabelText('Description'), 'Steps to reproduce');
  await user.type(screen.getByLabelText('Assignee'), 'Dara');
  await user.tab();
  expect(await screen.findByText("Assignee isn't saved yet.")).toBeInTheDocument();
  first.unmount();
  expect(hasDrafts()).toBe(true);

  open(server);
  expect(screen.getByLabelText('Title')).toHaveValue('Ticket 1 on Android');
  expect(screen.getByLabelText('Description')).toHaveValue('Steps to reproduce');
  expect(screen.getByLabelText('Assignee')).toHaveValue('Dara');
  expect(screen.getByText("Title isn't saved yet.")).toBeInTheDocument();
  expect(screen.getByText("Description isn't saved yet.")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry saving assignee' })).toBeInTheDocument();

  goOnline(server);
  await waitFor(() =>
    expect(server.detail.ticket).toMatchObject({
      title: 'Ticket 1 on Android',
      description: 'Steps to reproduce',
      assignee: 'Dara',
    }),
  );
  await waitFor(() => expect(unsavedNotes()).toHaveLength(0));
  expect(screen.getByLabelText('Description')).toHaveValue('Steps to reproduce');
  expect(hasDrafts()).toBe(false);
});

it('keeps a failed comment edit and an unsent comment through leaving, and saves only the edit', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(withComment());
  goOffline(server);
  const first = open(server);
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ' and a second');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText("Your edit isn't saved yet.")).toBeInTheDocument();
  await user.type(screen.getByLabelText('Comment'), 'Half a thought');
  first.unmount();

  const { client } = open(server);
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought and a second');
  expect(screen.getByText("Your edit isn't saved yet.")).toBeInTheDocument();
  expect(screen.getByLabelText('Comment')).toHaveValue('Half a thought');

  goOnline(server);
  await waitFor(() => expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument());
  const log = screen.getByRole('region', { name: 'Activity' });
  expect(within(log).getByText('First thought and a second')).toBeInTheDocument();
  expect(server.detail.activity[0]?.text).toBe('First thought and a second');
  expect(screen.getByLabelText('Comment')).toHaveValue('Half a thought');
  expect(client.addComment).not.toHaveBeenCalled();
});

it('saves text left in a closed ticket once the tracker can be reached again', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(makeTicketDetail());
  goOffline(server);
  const first = open(server);
  await user.type(screen.getByLabelText('Description'), 'Steps to reproduce');
  await user.tab();
  expect(await screen.findByText("Description isn't saved yet.")).toBeInTheDocument();
  first.unmount();

  open(server, { children: <p>Project screen</p> });
  goOnline(server);
  await waitFor(() => expect(server.detail.ticket.description).toBe('Steps to reproduce'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
});

async function typeOfflineThenAgentEdits(server: FakeTicketServer) {
  const user = userEvent.setup();
  goOffline(server);
  const first = open(server);
  await user.type(screen.getByLabelText('Description'), 'Mine');
  await user.tab();
  expect(await screen.findByText("Description isn't saved yet.")).toBeInTheDocument();
  first.unmount();
  server.edit({ description: 'Theirs' });
  goOnline(server);
  open(server);
  expect(
    await screen.findByText("Description changed elsewhere while yours wasn't saved."),
  ).toBeInTheDocument();
  return user;
}

it('keeps typed text the tracker changed meanwhile, says so, and saves nothing until asked', async () => {
  const server = fakeTicketServer(makeTicketDetail());
  const user = await typeOfflineThenAgentEdits(server);
  expect(screen.getByLabelText('Description')).toHaveValue('Mine');
  expect(server.detail.ticket.description).toBe('Theirs');

  await user.click(screen.getByRole('button', { name: 'Save my description' }));
  await waitFor(() => expect(server.detail.ticket.description).toBe('Mine'));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(screen.queryByText(/changed elsewhere/)).not.toBeInTheDocument();
});

it('drops the typed text for the tracker’s version when the user picks it', async () => {
  const server = fakeTicketServer(makeTicketDetail());
  const user = await typeOfflineThenAgentEdits(server);
  await user.click(screen.getByRole('button', { name: 'Use the saved description' }));
  expect(screen.getByLabelText('Description')).toHaveValue('Theirs');
  expect(screen.queryByText(/changed elsewhere/)).not.toBeInTheDocument();
  expect(hasDrafts()).toBe(false);
  expect(server.detail.ticket.description).toBe('Theirs');
});

it('asks before the page unloads while typed text is not saved', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(makeTicketDetail());
  goOffline(server);
  open(server);
  const unload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(unload()).toBe(false);
  await user.type(screen.getByLabelText('Title'), '!');
  await user.tab();
  expect(await screen.findByText("Title isn't saved yet.")).toBeInTheDocument();
  expect(unload()).toBe(true);

  goOnline(server);
  await waitFor(() => expect(server.detail.ticket.title).toBe('Ticket 1!'));
  await waitFor(() => expect(unload()).toBe(false));
});

it('says so when Retry cannot reach the tracker, and keeps the text', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(makeTicketDetail());
  goOffline(server);
  open(server);
  await user.type(screen.getByLabelText('Title'), '!');
  await user.tab();
  const firstToast = await screen.findByText(NETWORK_ERROR_MESSAGE);
  await user.click(screen.getByRole('button', { name: 'Retry saving title' }));
  await waitFor(() => expect(screen.getByText(NETWORK_ERROR_MESSAGE)).not.toBe(firstToast));
  expect(screen.getByLabelText('Title')).toHaveValue('Ticket 1!');
  expect(screen.getByText("Title isn't saved yet.")).toBeInTheDocument();
});
