import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { listItem, makeBoard, STATUS, statuses } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import {
  getListView,
  resetListView,
  setListFilter,
} from '../../src/features/project/listViewStore';
import { NewTicketSheet } from '../../src/features/project/NewTicketSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// With a status tab picked, New ticket (the header's, the nav bar's or the empty project's) started
// in the first status, so creating it switched the list back to All and the ticket's tab was lost
// (PT-63 review).

const { commentCount: _c, attachmentCount: _a, ...created } = listItem(5, STATUS.review, -1000);

function openNewTicket(board = makeBoard()) {
  const createTicket = vi.fn().mockResolvedValue(created);
  const api = setupApi({
    createTicket,
    getBoard: vi.fn().mockResolvedValue(board),
    listPeople: vi.fn().mockResolvedValue([]),
  });
  api.queryClient.setQueryData(queryKeys.board('MOB'), board);
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <NewTicketSheet open projectKey="MOB" onClose={() => undefined} />
      </ToastProvider>
    </Wrapper>,
  );
  return { user: userEvent.setup(), createTicket };
}

const statusRow = () => screen.getByRole('button', { name: /^Status/ });

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  localStorage.clear();
});

describe('regression: New ticket starts in the picked status tab', () => {
  it('creates the ticket in that status and stays on the tab', async () => {
    setListFilter('MOB', STATUS.review);
    const { user, createTicket } = openNewTicket();
    expect(statusRow()).toHaveAccessibleName('Status Need review');
    await user.type(screen.getByLabelText('Ticket title'), 'Check the copy{Enter}');
    await waitFor(() =>
      expect(createTicket).toHaveBeenCalledWith(
        'MOB',
        expect.objectContaining({ statusId: STATUS.review }),
      ),
    );
    expect(await screen.findByText('MOB-5 created')).toBeInTheDocument();
    expect(getListView('MOB').filter).toBe(STATUS.review);
  });

  it('starts in the first status on All', () => {
    openNewTicket();
    expect(statusRow()).toHaveAccessibleName('Status To do');
  });

  it('starts in the first status when the picked status was deleted', () => {
    setListFilter('MOB', STATUS.review);
    const left = statuses.filter((status) => status.id !== STATUS.review);
    openNewTicket({ ...makeBoard(), statuses: left });
    expect(statusRow()).toHaveAccessibleName('Status To do');
  });
});
