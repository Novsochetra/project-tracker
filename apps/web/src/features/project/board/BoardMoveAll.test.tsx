import type { ProjectBoard } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../../api/test/fixtures';
import { readMenuConfirm } from '../../../components/Popover/testing';
import { mockPhone, readActionSheet, skipAnimations } from '../../../overlays/testing';
import { resetListView } from '../listViewStore';
import { fakeBoardServer } from '../test/fakeBoardServer';
import { renderProject } from '../test/renderProject';
import { setViewMode } from '../viewModeStore';

vi.mock('../../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

// To do: MOB-1 · Reviewed: MOB-4, MOB-3, MOB-2 · Done: MOB-5
const board = () =>
  makeBoard([
    listItem(1, STATUS.todo, 0),
    listItem(2, STATUS.reviewed, 0),
    listItem(3, STATUS.reviewed, -1000),
    listItem(4, STATUS.reviewed, -2000),
    listItem(5, STATUS.done, 0),
  ]);

const column = (name: string) => screen.getByRole('region', { name });
const header = (name: string) => within(column(name)).getByText(name).parentElement!;
const cardKeys = (name: string) =>
  within(column(name))
    .queryAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);
const handleName = (key: string) => `Move ${key}. Drag, or use the arrow keys.`;
const moveAll = () => within(column('Reviewed')).queryByRole('button', { name: 'Move 3 to Done' });

const places = ({ tickets }: ProjectBoard) =>
  tickets.map(({ key, statusId, rank }) => `${key} ${statusId} ${rank}`).sort();

async function showBoard(start: ProjectBoard = board()) {
  const server = fakeBoardServer(start);
  renderProject({ client: server.client });
  await screen.findByRole('region', { name: 'Need review' });

  return server;
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
  setViewMode('MOB', 'board');
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  window.localStorage.clear();
});

describe("Move all to Done in the board's Reviewed column", () => {
  it("is the double check alone in the Reviewed column's header, before its +", async () => {
    await showBoard();

    const button = within(header('Reviewed')).getByRole('button', { name: 'Move 3 to Done' });
    expect(button).toHaveAttribute('title', 'Move 3 to Done');
    expect(button).toHaveTextContent('');
    expect(button.parentElement?.nextElementSibling).toBe(
      within(header('Reviewed')).getByRole('button', { name: 'New ticket in Reviewed' }),
    );
    for (const name of ['To do', 'In progress', 'Need review', 'Done']) {
      expect(within(column(name)).queryByRole('button', { name: /^Move \d+ to/ })).toBeNull();
    }
  });

  it('leaves out a column with one reviewed ticket, which has its own move', async () => {
    await showBoard(makeBoard([listItem(2, STATUS.reviewed, 0), listItem(5, STATUS.done, 0)]));

    expect(within(column('Reviewed')).queryByRole('button', { name: /^Move \d+ to/ })).toBeNull();
  });

  it('asks in a menu, moves the column to the top of Done, and Undo puts it back', async () => {
    const user = userEvent.setup();
    const server = await showBoard();

    await user.click(moveAll()!);
    await readMenuConfirm();
    expect(screen.getByRole('group', { name: 'Move to Done' })).toHaveTextContent(
      'Move all 3 tickets to Done?',
    );
    await user.click(screen.getByRole('button', { name: 'Move to Done' }));

    expect(server.client.moveToDone).toHaveBeenCalledWith(['MOB-4', 'MOB-3', 'MOB-2']);
    expect(await screen.findByText('3 tickets moved to Done')).toBeInTheDocument();
    await waitFor(() => expect(cardKeys('Done')).toEqual(['MOB-4', 'MOB-3', 'MOB-2', 'MOB-5']));
    expect(within(column('Reviewed')).getByText('No tickets')).toBeInTheDocument();
    expect(moveAll()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('3 tickets moved back')).toBeInTheDocument();
    await waitFor(() => expect(cardKeys('Reviewed')).toEqual(['MOB-4', 'MOB-3', 'MOB-2']));
    expect(cardKeys('Done')).toEqual(['MOB-5']);
    expect(places(server.board)).toEqual(places(board()));
  });

  it('moves nothing when the menu is cancelled', async () => {
    const user = userEvent.setup();
    const server = await showBoard();

    await user.click(moveAll()!);
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(server.client.moveToDone).not.toHaveBeenCalled();
    expect(cardKeys('Reviewed')).toEqual(['MOB-4', 'MOB-3', 'MOB-2']);
    expect(moveAll()).toHaveFocus();
  });

  it("takes a keyboard user to the first card's handle in Done", async () => {
    const user = userEvent.setup();
    await showBoard();

    moveAll()!.focus();
    await user.keyboard('{Enter}');
    await readMenuConfirm();
    screen.getByRole('button', { name: 'Move to Done' }).focus();
    await user.keyboard('{Enter}');

    const handle = () => screen.getByRole('button', { name: handleName('MOB-4') });
    await waitFor(() => expect(cardKeys('Done')).toEqual(['MOB-4', 'MOB-3', 'MOB-2', 'MOB-5']));
    await waitFor(() => expect(handle()).toHaveFocus());
    expect(within(column('Done')).getByRole('button', { name: handleName('MOB-4') })).toBe(
      handle(),
    );
  });

  it('keeps focus in the column, on its +, while Done is not shown', async () => {
    const user = userEvent.setup();
    const server = await showBoard();
    const toolbar = screen.getByRole('toolbar', { name: 'Filter tickets' });
    await user.click(within(toolbar).getByRole('button', { name: /^Reviewed/ }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Done' })).toBeNull());

    moveAll()!.focus();
    await user.keyboard('{Enter}');
    await readMenuConfirm();
    screen.getByRole('button', { name: 'Move to Done' }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(moveAll()).toBeNull());
    expect(server.client.moveToDone).toHaveBeenCalledTimes(1);
    expect(
      within(column('Reviewed')).getByRole('button', { name: 'New ticket in Reviewed' }),
    ).toHaveFocus();
  });

  describe('on phones', () => {
    beforeEach(() => {
      restore.push(mockPhone(true));
    });

    it('is the same icon in the header and asks in an action sheet', async () => {
      const user = userEvent.setup();
      const server = await showBoard();

      const button = within(header('Reviewed')).getByRole('button', { name: 'Move 3 to Done' });
      await user.click(button);
      const sheet = screen.getByRole('dialog', { name: 'Move to Done' });
      await readActionSheet();
      expect(sheet).toHaveTextContent('Move all 3 tickets to Done?');
      await user.click(within(sheet).getByRole('button', { name: 'Move 3 to Done' }));

      await waitFor(() => expect(cardKeys('Done')).toEqual(['MOB-4', 'MOB-3', 'MOB-2', 'MOB-5']));
      expect(server.client.moveToDone).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('3 tickets moved to Done')).toBeInTheDocument();
    });
  });
});
