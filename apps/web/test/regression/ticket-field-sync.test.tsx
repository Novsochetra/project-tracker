import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup() {
  const detail = makeTicketDetail();
  const updateTicket = vi.fn().mockResolvedValue(detail.ticket);
  const rendered = renderTicket({ detail, client: { updateTicket } });
  cleanups.push(rendered.restorePhone);
  const agentChanges = (fields: Partial<TicketDetail['ticket']>) =>
    act(() => {
      rendered.queryClient.setQueryData<TicketDetail>(queryKeys.ticket('MOB-1'), (current) =>
        current ? { ...current, ticket: { ...current.ticket, ...fields } } : current,
      );
    });
  return { ...rendered, agentChanges };
}

// The debounced save had gone out, an agent then renamed the ticket, and leaving the field
// saved nothing: the field kept showing the typed title while the server had the agent's.
it('saves the typed title on blur when an agent changed it after the last autosave', async () => {
  const user = userEvent.setup();
  const { client, agentChanges } = setup();
  const title = screen.getByLabelText('Title');
  await user.type(title, ' fixed');
  await waitFor(() => expect(client.updateTicket).toHaveBeenCalledTimes(1), { timeout: 2000 });
  agentChanges({ title: 'Renamed by Claude' });
  await user.tab();
  expect(client.updateTicket).toHaveBeenCalledTimes(2);
  expect(client.updateTicket).toHaveBeenLastCalledWith('MOB-1', { title: 'Ticket 1 fixed' });
  expect(title).toHaveValue('Ticket 1 fixed');
});

// Only focusing the assignee and leaving it wrote the old name back over an agent's change.
it('does not write an untouched assignee back over an agent’s change', async () => {
  const user = userEvent.setup();
  const { client, agentChanges } = setup();
  const assignee = screen.getByLabelText('Assignee');
  await user.click(assignee);
  agentChanges({ assignee: 'Claude' });
  await user.tab();
  expect(client.updateTicket).not.toHaveBeenCalled();
  expect(assignee).toHaveValue('Claude');
});
