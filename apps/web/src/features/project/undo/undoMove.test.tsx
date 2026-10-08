import type { TicketsAcrossProjects } from '@tracker/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys, useReadyForYou } from '../../../api';
import { patchBoardTicket } from '../../../api/cache/board';
import { deferred } from '../../../api/test/deferred';
import { listItem, makeBoard, project, STATUS, statuses } from '../../../api/test/fixtures';
import { announce } from '../../../app/announce';
import { renderWithApp } from '../../../app/test/harness';
import { mockPhone, skipAnimations } from '../../../overlays/testing';
import { readyItems } from '../../ready/readyItems';
import { ReadySection } from '../../ready/ReadySection';
import { resetListView } from '../listViewStore';
import { fakeBoardServer } from '../test/fakeBoardServer';
import { renderProject } from '../test/renderProject';
import { setViewMode } from '../viewModeStore';

vi.mock('../../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

// To do: MOB-1, MOB-2, MOB-5 · In progress: MOB-3 · Done: MOB-4
const board = () =>
  makeBoard([
    listItem(1, STATUS.todo, 0),
    listItem(2, STATUS.todo, 1000),
    listItem(5, STATUS.todo, 2000),
    listItem(3, STATUS.progress, 0),
    listItem(4, STATUS.done, 0),
  ]);

const group = (name: string) => screen.getByRole('region', { name });
const keysIn = (name: string) =>
  within(group(name))
    .queryAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);
const toast = (text: string) => screen.getByText(text, { exact: true });
const undoButton = () => screen.getByRole('button', { name: 'Undo' });
const noUndo = () => expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
const handle = (key: string) =>
  screen.getByRole('button', { name: `Move ${key}. Drag, or use the arrow keys.` });

// Swipe gestures need real touch input; the actions they reveal are plain buttons underneath.
function swipeAction(key: string, label: string) {
  const row = screen
    .getByRole('button', { name: new RegExp(`^${key}\\b`) })
    .closest<HTMLElement>('[data-drop-row]');
  const action = row && within(row).getByText(label).closest('button');
  if (!action) throw new Error(`No ${label} action on ${key}`);
  fireEvent.click(action);
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  window.localStorage.clear();
  announce('');
});

describe('Undo after a swipe on the Project screen', () => {
  beforeEach(() => restore.push(mockPhone(true)));

  it('puts the ticket back in its status, between the same tickets', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'To do' });

    swipeAction('MOB-2', 'In progress');
    expect(toast('MOB-2 moved to In progress')).toBeInTheDocument();
    await waitFor(() => expect(keysIn('In progress')).toEqual(['MOB-2', 'MOB-3']));
    await user.click(undoButton());

    expect(toast('MOB-2 moved to To do')).toBeInTheDocument();
    noUndo();
    await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-2', 'MOB-5']));
    expect(server.client.moveTicket).toHaveBeenCalledTimes(1);
    expect(server.client.moveTicket).toHaveBeenCalledWith('MOB-2', {
      statusId: STATUS.todo,
      beforeId: 't-5',
    });
    expect(server.board.tickets.find((ticket) => ticket.key === 'MOB-2')?.statusId).toBe(
      STATUS.todo,
    );
  });

  it('waits for the move to be saved, and undoes nothing when the move was refused', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    const first = deferred<never>();
    server.client.updateTicket.mockImplementationOnce(() => first.promise);
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'To do' });

    swipeAction('MOB-2', 'In progress');
    await user.click(undoButton());
    expect(server.client.moveTicket).not.toHaveBeenCalled();
    act(() => first.reject(new TypeError('Failed to fetch')));

    expect(
      await screen.findByText("Can't reach the tracker. Check your connection."),
    ).toBeVisible();
    await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-2', 'MOB-5']));
    expect(server.client.moveTicket).not.toHaveBeenCalled();
  });

  it('finds the ticket’s place in the list as it is now, after live updates changed it', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    const { queryClient } = renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'To do' });

    swipeAction('MOB-2', 'In progress');
    await waitFor(() => expect(server.client.updateTicket).toHaveBeenCalled());
    server.edit((current) => patchBoardTicket(current, 'MOB-5', { statusId: STATUS.done }));
    await act(() => queryClient.invalidateQueries({ queryKey: queryKeys.board('MOB') }));
    await waitFor(() => expect(keysIn('Done')).toEqual(['MOB-5', 'MOB-4']));

    await user.click(undoButton());
    await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-2']));
    expect(server.client.moveTicket).toHaveBeenCalledWith('MOB-2', {
      statusId: STATUS.todo,
      afterId: 't-1',
    });
  });

  it('says so with an error toast when the move back fails, and leaves the ticket moved', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    server.client.moveTicket.mockImplementationOnce(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'To do' });

    swipeAction('MOB-2', 'In progress');
    await waitFor(() => expect(server.client.updateTicket).toHaveBeenCalled());
    await user.click(undoButton());

    const failure = await screen.findByText("Can't reach the tracker. Check your connection.");
    expect(failure.parentElement?.querySelector('svg')).toHaveClass('lucide-circle-alert');
    await waitFor(() => expect(keysIn('In progress')).toEqual(['MOB-2', 'MOB-3']));
    expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-5']);
  });

  it('undoes a move picked in the Status sheet', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'To do' });

    swipeAction('MOB-1', 'Status');
    const sheet = await screen.findByRole('dialog', { name: 'Status' });
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(toast('MOB-1 moved to Done')).toBeInTheDocument();
    await waitFor(() => expect(server.client.updateTicket).toHaveBeenCalled());
    await user.click(undoButton());

    await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-2', 'MOB-5']));
    expect(server.client.moveTicket).toHaveBeenCalledWith('MOB-1', {
      statusId: STATUS.todo,
      beforeId: 't-2',
    });
  });
});

describe('Undo after a move on the board', () => {
  beforeEach(() => {
    restore.push(mockPhone(false));
    setViewMode('MOB', 'board');
  });

  it('takes a keyboard move back with ⌘Z and keeps the card’s handle focused', async () => {
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'Need review' });

    handle('MOB-2').focus();
    fireEvent.keyDown(handle('MOB-2'), { key: 'ArrowRight' });
    expect(toast('MOB-2 moved to In progress')).toBeInTheDocument();
    await waitFor(() => expect(server.client.moveTicket).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(keysIn('In progress')).toEqual(['MOB-3', 'MOB-2']));
    expect(handle('MOB-2')).toHaveFocus();

    fireEvent.keyDown(handle('MOB-2'), { key: 'z', metaKey: true });
    expect(toast('MOB-2 moved to To do')).toBeInTheDocument();
    await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-2', 'MOB-5']));
    expect(server.client.moveTicket).toHaveBeenLastCalledWith('MOB-2', {
      statusId: STATUS.todo,
      beforeId: 't-5',
    });
    expect(handle('MOB-2')).toHaveFocus();
  });

  it('offers no Undo for a move within the column, which only reorders', async () => {
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'Need review' });

    handle('MOB-2').focus();
    fireEvent.keyDown(handle('MOB-2'), { key: 'ArrowUp' });
    await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-2', 'MOB-1', 'MOB-5']));
    noUndo();
  });
});

describe('Undo after Done in Ready for you', () => {
  beforeEach(() => restore.push(mockPhone(false)));

  function ReadyFromServer() {
    return <ReadySection items={readyItems(useReadyForYou().data, [project])} />;
  }

  it('reads the project’s tickets to put the ticket back above the one that followed it', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(
      makeBoard([listItem(3, STATUS.reviewed, 0), listItem(7, STATUS.reviewed, 500)]),
    );
    const ready: TicketsAcrossProjects = { tickets: [listItem(3, STATUS.reviewed, 0)], statuses };
    renderWithApp(<ReadyFromServer />, {
      client: { ...server.client, listAllTickets: vi.fn().mockResolvedValue(ready) },
    });
    await user.click(await screen.findByRole('button', { name: 'Move MOB-3 to Done' }));
    await waitFor(() => expect(server.client.updateTicket).toHaveBeenCalled());
    await user.click(undoButton());

    expect(toast('MOB-3 moved to Reviewed')).toBeInTheDocument();
    await waitFor(() =>
      expect(server.client.moveTicket).toHaveBeenCalledWith('MOB-3', {
        statusId: STATUS.reviewed,
        beforeId: 't-7',
      }),
    );
    expect(server.client.getBoard).toHaveBeenCalledWith('MOB');
  });
});
