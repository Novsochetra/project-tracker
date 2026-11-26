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

const release: Label = { ...bug, id: 'l-rel', name: 'v1.4', template: '', instructions: '' };

const { commentCount: _c, attachmentCount: _a, ...created } = listItem(5, STATUS.todo, -1000);

function renderSheet() {
  let board = { ...makeBoard(), labels: [bug] };
  const createTicket = vi.fn().mockResolvedValue({ ...created, labelIds: ['l-bug'] });
  // The board's refetch after a new label has it, as the server's would.
  const createLabel = vi.fn(() => {
    board = { ...board, labels: [bug, release] };
    return Promise.resolve(release);
  });
  const api = setupApi({
    createTicket,
    createLabel,
    getBoard: vi.fn(() => Promise.resolve(board)),
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
  return { createTicket, createLabel, user: userEvent.setup() };
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

  it('make a new label over the sheet, which the ticket is created with', async () => {
    const { createTicket, createLabel, user } = renderSheet();
    await user.click(screen.getByRole('button', { name: /^Labels/ }));
    const picker = screen.getByRole('dialog', { name: 'Pick labels' });
    await user.type(within(picker).getByRole('searchbox'), 'v1.4{Enter}');
    expect(createLabel).toHaveBeenCalledWith('MOB', { name: 'v1.4', color: expect.any(String) });
    expect(await within(picker).findByRole('option', { name: 'v1.4' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    const sheet = screen.getByRole('dialog', { name: 'New ticket' });
    expect(within(sheet).getByRole('button', { name: /^Labels/ })).toHaveTextContent('v1.4');
    await user.type(within(sheet).getByLabelText('Ticket title'), 'Ship the release');
    await user.click(within(sheet).getByRole('button', { name: 'Create' }));
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ labelIds: ['l-rel'] }),
    );
  });
});
