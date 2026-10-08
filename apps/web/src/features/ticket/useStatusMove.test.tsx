import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectBoard, TicketListItem } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queryKeys } from '../../api';
import { comment, listItem, makeBoard, makeTicketDetail, STATUS } from '../../api/test/fixtures';
import { skipAnimations } from '../../overlays/testing';
import { fakeBoardServer } from '../project/test/fakeBoardServer';
import { renderTicket } from './test/renderTicket';

const approval = comment('v1', 'Works on both phones.', {
  type: 'review',
  actor: { kind: 'agent', name: 'Claude (reviewer)' },
  review: { verdict: 'approved', rating: 4 },
});

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup(item: TicketListItem, board: ProjectBoard) {
  const server = fakeBoardServer(board);
  const rendered = renderTicket({
    detail: makeTicketDetail(item, { activity: [approval] }),
    client: server.client,
  });
  rendered.queryClient.setQueryData(queryKeys.board('MOB'), board);
  cleanups.push(rendered.restorePhone);
  return server;
}

const toast = (text: string) => screen.getByText(text, { exact: true });
const statusRow = () => screen.getByRole('button', { name: /^Status/ });
const latestReview = () => screen.getByRole('region', { name: 'Latest review' });

describe('Undo on the ticket screen', () => {
  it('takes back a status picked in the Status dropdown', async () => {
    const user = userEvent.setup();
    const server = setup(listItem(1, STATUS.todo, 0), makeBoard());
    await user.click(statusRow());
    const list = screen.getByRole('listbox', { name: 'Status' });
    await user.click(within(list).getByRole('option', { name: 'In progress' }));
    expect(toast('MOB-1 moved to In progress')).toBeInTheDocument();
    await waitFor(() =>
      expect(server.client.updateTicket).toHaveBeenCalledWith('MOB-1', {
        statusId: STATUS.progress,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(toast('MOB-1 moved to To do')).toBeInTheDocument();
    await waitFor(() => expect(statusRow()).toHaveTextContent('To do'));
    expect(server.client.moveTicket).toHaveBeenCalledWith('MOB-1', {
      statusId: STATUS.todo,
      beforeId: 't-2',
    });
  });

  it('takes back Move to Done, which then shows again', async () => {
    const user = userEvent.setup();
    const reviewed = listItem(1, STATUS.reviewed, 0);
    const server = setup(reviewed, makeBoard([reviewed, listItem(6, STATUS.reviewed, 1000)]));
    await user.click(within(latestReview()).getByRole('button', { name: 'Move to Done' }));
    expect(toast('MOB-1 moved to Done')).toBeInTheDocument();
    await waitFor(() => expect(server.client.updateTicket).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(toast('MOB-1 moved to Reviewed')).toBeInTheDocument();
    expect(
      await within(await screen.findByRole('region', { name: 'Latest review' })).findByRole(
        'button',
        { name: 'Move to Done' },
      ),
    ).toBeVisible();
    expect(server.client.moveTicket).toHaveBeenCalledWith('MOB-1', {
      statusId: STATUS.reviewed,
      beforeId: 't-6',
    });
  });
});
