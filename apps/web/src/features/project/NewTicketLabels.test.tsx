import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Label } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../api';
import { listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { setupApi } from '../../api/test/render';
import { ToastProvider } from '../../components';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { resetListView } from './listViewStore';
import { NewTicketSheet } from './NewTicketSheet';

const TEMPLATE = '## Steps to reproduce\n1. ';

const bug: Label = {
  id: 'l-bug',
  projectId: 'p1',
  name: 'Bug',
  color: '#B42318',
  template: TEMPLATE,
  instructions: 'Write a failing test first.',
  position: 0,
  createdAt: 1,
};

const { commentCount: _c, attachmentCount: _a, ...created } = listItem(5, STATUS.todo, -1000);

function renderSheet() {
  const board = { ...makeBoard(), labels: [bug] };
  const createTicket = vi.fn().mockResolvedValue({ ...created, labelIds: ['l-bug'] });
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
  return { createTicket, user: userEvent.setup() };
}

const pickBug = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /^Labels/ }));
  await user.click(screen.getByRole('option', { name: 'Bug' }));
  await user.keyboard('{Escape}');
};

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  localStorage.clear();
});

describe('labels in New ticket', () => {
  it('start an empty description from the label’s template and go with the ticket', async () => {
    const { createTicket, user } = renderSheet();
    await pickBug(user);
    expect(screen.getByLabelText('Description')).toHaveValue(TEMPLATE);
    expect(screen.getByRole('button', { name: /^Labels/ })).toHaveTextContent('Bug');
    await user.type(screen.getByLabelText('Ticket title'), 'Crash on rotate');
    await user.click(
      within(screen.getByRole('dialog', { name: 'New ticket' })).getByRole('button', {
        name: 'Create',
      }),
    );
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ labelIds: ['l-bug'], description: '## Steps to reproduce\n1.' }),
    );
  });

  it('never replace a description already typed', async () => {
    const { user } = renderSheet();
    await user.type(screen.getByLabelText('Description'), 'It crashes.');
    await pickBug(user);
    expect(screen.getByLabelText('Description')).toHaveValue('It crashes.');
  });
});
