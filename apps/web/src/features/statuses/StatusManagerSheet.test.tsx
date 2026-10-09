import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { CreateStatusInput, ProjectBoard, Status, UpdateStatusInput } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBoard, project, STATUS, statuses } from '../../api/test/fixtures';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { renderWithApi, sheetTestSetup } from '../claude/test/renderWithApi';
import { StatusManagerSheet } from './StatusManagerSheet';

function fakeStatusServer(initial: ProjectBoard = makeBoard()) {
  let board = initial;
  const save = (next: Status[]) => {
    board = { ...board, statuses: next };
  };
  return {
    getBoard: vi.fn(() => Promise.resolve(board)),
    createStatus: vi.fn((_key: string, input: CreateStatusInput) => {
      const status: Status = {
        id: 's-new',
        projectId: project.id,
        name: input.name,
        category: input.category,
        color: input.color ?? '#8E8E99',
        position: board.statuses.length,
        createdAt: 2,
      };
      save([...board.statuses, status]);
      return Promise.resolve(status);
    }),
    updateStatus: vi.fn((id: string, input: UpdateStatusInput) => {
      const status = { ...board.statuses.find((item) => item.id === id)!, ...input };
      save(board.statuses.map((item) => (item.id === id ? status : item)));
      return Promise.resolve(status);
    }),
    reorderStatuses: vi.fn((_key: string, ids: string[]) => {
      save(ids.map((id, position) => ({ ...board.statuses.find((s) => s.id === id)!, position })));
      return Promise.resolve(board.statuses);
    }),
    deleteStatus: vi.fn((id: string) => {
      save(board.statuses.filter((item) => item.id !== id));
      return Promise.resolve(undefined);
    }),
  };
}

function Harness() {
  const [open, setOpen] = useState(true);
  return <StatusManagerSheet open={open} onClose={() => setOpen(false)} projectKey="MOB" />;
}

const sheet = () => screen.getByRole('dialog', { name: 'Statuses' });
const row = (name: string) => within(sheet()).getByRole('button', { name: new RegExp(`^${name}`) });
const nameField = () => within(sheet()).getByRole('textbox', { name: 'Status name' });
const saveButton = () => within(sheet()).getByRole('button', { name: 'Save status' });

// The sheet holds presses right after the confirm appears (StatusEditor), so a test reads it
// first, like a person.
async function askDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(sheet()).getByRole('button', { name: 'Delete status' }));
  await new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));
}

async function openSheet(server = fakeStatusServer()) {
  const view = renderWithApi(<Harness />, server);
  await within(sheet()).findByText('To do', { exact: true });
  return { ...view, server, user: userEvent.setup() };
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
});

afterEach(() => {
  restore();
});

describe('StatusManagerSheet', () => {
  it('lists the statuses in order with their ticket counts', async () => {
    await openSheet();
    expect(within(sheet()).getByText('Mobile app')).toBeInTheDocument();
    const names = within(sheet())
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(names).toEqual([
      'To do2 tickets',
      'In progress1 ticket',
      'Need review0 tickets',
      'Reviewed0 tickets',
      'Done1 ticket',
    ]);
  });

  it('adds a status with a name, a type and a color', async () => {
    const { server, user } = await openSheet();
    await user.click(within(sheet()).getByRole('button', { name: 'Add status' }));
    expect(nameField()).toHaveFocus();
    expect(saveButton()).toBeDisabled();
    expect(within(sheet()).getByText('Add a name to save the status.')).toBeInTheDocument();
    expect(within(sheet()).getByRole('radio', { name: 'Violet' })).toBeChecked();

    await user.type(nameField(), 'Blocked');
    await user.click(within(sheet()).getByRole('radio', { name: 'Red' }));
    await user.click(saveButton());

    expect(server.createStatus).toHaveBeenCalledWith('MOB', {
      name: 'Blocked',
      category: 'in_progress',
      color: '#B42318',
    });
    expect(await within(sheet()).findByText('Blocked', { exact: true })).toBeInTheDocument();
    expect(within(sheet()).queryByRole('textbox', { name: 'Status name' })).not.toBeInTheDocument();
    expect(row('Blocked')).toHaveFocus();
    expect(within(row('Blocked')).getByText('In progress')).toBeInTheDocument();
  });

  it('explains why a duplicate name can’t be saved', async () => {
    const { user } = await openSheet();
    await user.click(within(sheet()).getByRole('button', { name: 'Add status' }));
    await user.type(nameField(), 'done');
    expect(saveButton()).toBeDisabled();
    expect(within(sheet()).getByRole('alert')).toHaveTextContent(
      'A status named “Done” already exists.',
    );
  });

  it('renames, recolors and retypes a status, sending only the changes', async () => {
    const { server, user } = await openSheet();
    await user.click(row('In progress'));
    expect(nameField()).toHaveValue('In progress');
    await user.clear(nameField());
    await user.type(nameField(), 'Doing{Enter}');
    await waitFor(() =>
      expect(server.updateStatus).toHaveBeenCalledWith(STATUS.progress, { name: 'Doing' }),
    );
    expect(await within(sheet()).findByText('Doing', { exact: true })).toBeInTheDocument();

    await user.click(row('Doing'));
    await user.click(within(sheet()).getByRole('radio', { name: 'Teal' }));
    await user.click(within(sheet()).getByRole('button', { name: /^Type/ }));
    await user.click(screen.getByRole('option', { name: 'Need review' }));
    await user.click(saveButton());
    await waitFor(() =>
      expect(server.updateStatus).toHaveBeenLastCalledWith(STATUS.progress, {
        category: 'in_review',
        color: '#12A594',
      }),
    );
  });

  it('closes the editor without saving on Cancel, Escape or an unchanged Save', async () => {
    const { server, user } = await openSheet();
    await user.click(row('Reviewed'));
    await user.click(within(sheet()).getByRole('button', { name: 'Cancel' }));
    expect(row('Reviewed')).toHaveFocus();

    await user.click(row('Reviewed'));
    await user.keyboard('{Escape}');
    expect(sheet()).toBeInTheDocument();
    expect(row('Reviewed')).toHaveFocus();

    await user.click(row('Reviewed'));
    await user.click(saveButton());
    expect(row('Reviewed')).toHaveFocus();
    expect(server.updateStatus).not.toHaveBeenCalled();
  });

  it('deletes an empty status after confirming', async () => {
    const { server, user } = await openSheet();
    await user.click(row('Need review'));
    await askDelete(user);
    expect(within(sheet()).getByText("Delete “Need review”? This can't be undone.")).toBeVisible();
    expect(within(sheet()).queryByRole('button', { name: /^Move tickets to/ })).toBeNull();
    await user.click(within(sheet()).getByRole('button', { name: 'Delete' }));
    expect(server.deleteStatus).toHaveBeenCalledWith(STATUS.review, undefined);
    await waitFor(() =>
      expect(within(sheet()).queryByText('Need review', { exact: true })).not.toBeInTheDocument(),
    );
    expect(within(sheet()).getByRole('button', { name: 'Add status' })).toHaveFocus();
  });

  it('hides a deleted status before the list refreshes', async () => {
    const { server, user } = await openSheet();
    server.getBoard.mockReturnValue(new Promise(() => undefined));
    await user.click(row('Reviewed'));
    await askDelete(user);
    await user.click(within(sheet()).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(sheet()).queryByText('Reviewed', { exact: true })).not.toBeInTheDocument(),
    );
    expect(within(sheet()).getAllByRole('listitem')).toHaveLength(statuses.length - 1);
  });

  it('asks where the tickets of a status go before deleting it', async () => {
    const { server, user } = await openSheet();
    await user.click(row('To do'));
    await askDelete(user);
    expect(
      within(sheet()).getByText('Delete “To do” and move its 2 tickets to In progress?'),
    ).toBeInTheDocument();
    await user.click(within(sheet()).getByRole('button', { name: /^Move tickets to/ }));
    await user.click(screen.getByRole('option', { name: 'Reviewed' }));
    expect(
      within(sheet()).getByText('Delete “To do” and move its 2 tickets to Reviewed?'),
    ).toBeInTheDocument();
    await user.click(within(sheet()).getByRole('button', { name: 'Delete' }));
    expect(server.deleteStatus).toHaveBeenCalledWith(STATUS.todo, STATUS.reviewed);
  });

  it('won’t delete the last status', async () => {
    const only = statuses.filter((status) => status.id === STATUS.todo);
    const { user } = await openSheet(fakeStatusServer({ ...makeBoard([]), statuses: only }));
    await user.click(row('To do'));
    expect(within(sheet()).getByRole('button', { name: 'Delete status' })).toBeDisabled();
    expect(within(sheet()).getByText('A project needs at least one status.')).toBeInTheDocument();
  });

  it('moves a status with the arrow keys on its handle', async () => {
    const { server, user } = await openSheet();
    const handle = within(sheet()).getByRole('button', { name: 'Reorder Need review' });
    handle.focus();
    await user.keyboard('{ArrowUp}');
    expect(server.reorderStatuses).toHaveBeenCalledWith('MOB', [
      STATUS.todo,
      STATUS.review,
      STATUS.progress,
      STATUS.reviewed,
      STATUS.done,
    ]);
    await waitFor(() =>
      expect(within(sheet()).getAllByRole('listitem')[1]).toHaveTextContent('Need review'),
    );
    expect(handle).toHaveFocus();
  });

  it('shows a server error from saving', async () => {
    const server = fakeStatusServer();
    server.createStatus.mockRejectedValueOnce(
      new ApiError(409, 'conflict', 'A status named “Blocked” already exists.'),
    );
    const { user } = await openSheet(server);
    await user.click(within(sheet()).getByRole('button', { name: 'Add status' }));
    await user.type(nameField(), 'Blocked');
    await user.click(saveButton());
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent(
      'A status named “Blocked” already exists.',
    );
    expect(nameField()).toBeInTheDocument();
  });
});
