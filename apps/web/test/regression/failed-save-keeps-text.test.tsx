import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Like a real request, a failure lands after the optimistic update has been rendered, and a
// retry first reads what the tracker has now.
function setup(detail: TicketDetail = makeTicketDetail()) {
  const server = fakeTicketServer(detail);
  server.setReachable(false);
  const rendered = renderTicket({ detail, client: server.client });
  cleanups.push(rendered.restorePhone);
  return { ...rendered, server };
}

const reconnect = () =>
  act(() => {
    window.dispatchEvent(new Event('online'));
  });

// Offline, leaving the field saved it, the save failed, and its rollback replaced the typed text
// with the last saved one; going back online didn't bring it back.
it('keeps a description typed offline, says it is not saved, and saves it once back online', async () => {
  const user = userEvent.setup();
  const { client, server } = setup();
  const description = screen.getByLabelText('Description');
  await user.type(description, 'Steps to reproduce');
  await user.tab();
  expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
  expect(description).toHaveValue('Steps to reproduce');
  expect(screen.getByText("Description isn't saved yet.")).toBeInTheDocument();
  expect(hasDrafts()).toBe(true);

  server.setReachable(true);
  reconnect();
  await waitFor(() =>
    expect(screen.queryByText("Description isn't saved yet.")).not.toBeInTheDocument(),
  );
  expect(client.updateTicket).toHaveBeenLastCalledWith('MOB-1', {
    description: 'Steps to reproduce',
  });
  expect(description).toHaveValue('Steps to reproduce');
  expect(hasDrafts()).toBe(false);
});

it('keeps an assignee typed offline and saves it from the retry button', async () => {
  const user = userEvent.setup();
  const { client, server } = setup();
  const assignee = screen.getByLabelText('Assignee');
  await user.type(assignee, 'Dara');
  await user.tab();
  expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
  expect(assignee).toHaveValue('Dara');
  expect(screen.getByText("Assignee isn't saved yet.")).toBeInTheDocument();
  expect(hasDrafts()).toBe(true);

  server.setReachable(true);
  await user.click(screen.getByRole('button', { name: 'Retry saving assignee' }));
  await waitFor(() =>
    expect(screen.queryByText("Assignee isn't saved yet.")).not.toBeInTheDocument(),
  );
  expect(client.updateTicket).toHaveBeenLastCalledWith('MOB-1', { assignee: 'Dara' });
  expect(assignee).toHaveValue('Dara');
  expect(hasDrafts()).toBe(false);
});

// Save closed the inline editor at once, so a failed edit rolled back and the text was gone.
it('keeps the comment editor open with the edit when saving fails', async () => {
  const user = userEvent.setup();
  const { client, server } = setup(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ' and a second');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
  expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought and a second');
  expect(screen.getByText("Your edit isn't saved yet.")).toBeInTheDocument();
  expect(hasDrafts()).toBe(true);

  server.setReachable(true);
  reconnect();
  await waitFor(() => expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument());
  expect(client.updateComment).toHaveBeenLastCalledWith('c1', {
    text: 'First thought and a second',
  });
  const activity = screen.getByRole('region', { name: 'Activity' });
  expect(within(activity).getByText('First thought and a second')).toBeInTheDocument();
  expect(hasDrafts()).toBe(false);
});
