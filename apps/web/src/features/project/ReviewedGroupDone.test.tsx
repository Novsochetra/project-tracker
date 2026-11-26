import type { ProjectBoard } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { readMenuConfirm } from '../../components/Popover/testing';
import { mockPhone, readActionSheet, skipAnimations } from '../../overlays/testing';
import { resetListView } from './listViewStore';
import { fakeBoardServer } from './test/fakeBoardServer';
import { renderProject } from './test/renderProject';

vi.mock('../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

// To do: MOB-1 · Reviewed: MOB-4, MOB-3, MOB-2 · Done: MOB-5
const board = () =>
  makeBoard([
    listItem(1, STATUS.todo, 0),
    listItem(2, STATUS.reviewed, 0),
    listItem(3, STATUS.reviewed, -1000),
    listItem(4, STATUS.reviewed, -2000),
    listItem(5, STATUS.done, 0),
  ]);

const group = (name: string) => screen.queryByRole('region', { name });
const keysIn = (name: string) =>
  within(group(name)!)
    .queryAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);

const handleName = (key: string) => `Move ${key}. Drag, or use the arrow keys.`;

const places = ({ tickets }: ProjectBoard) =>
  tickets.map(({ key, statusId, rank }) => `${key} ${statusId} ${rank}`).sort();

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

describe("Move all to Done in a project's Reviewed group", () => {
  it("shows only in a reviewed group's header, with its count", async () => {
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'Reviewed' });
    const header = within(group('Reviewed')!).getByText('Reviewed').parentElement!;
    expect(within(header).getByRole('button', { name: 'Move 3 to Done' })).toBeInTheDocument();
    expect(within(group('To do')!).queryByRole('button', { name: /^Move \d+ to/ })).toBeNull();
    expect(within(group('Done')!).queryByRole('button', { name: /^Move \d+ to/ })).toBeNull();
  });

  it('moves the group to the top of Done in its order, and Undo puts it back', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    const reviewed = await screen.findByRole('region', { name: 'Reviewed' });
    await user.click(within(reviewed).getByRole('button', { name: 'Move 3 to Done' }));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Move to Done' }));

    expect(server.client.moveToDone).toHaveBeenCalledWith(['MOB-4', 'MOB-3', 'MOB-2']);
    expect(await screen.findByText('3 tickets moved to Done')).toBeInTheDocument();
    await waitFor(() => expect(keysIn('Done')).toEqual(['MOB-4', 'MOB-3', 'MOB-2', 'MOB-5']));
    expect(group('Reviewed')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('3 tickets moved back')).toBeInTheDocument();
    await waitFor(() => expect(keysIn('Reviewed')).toEqual(['MOB-4', 'MOB-3', 'MOB-2']));
    expect(keysIn('Done')).toEqual(['MOB-5']);
    expect(server.client.undoMoveToDone).toHaveBeenCalledTimes(1);
    expect(places(server.board)).toEqual(places(board()));
  });

  it('keeps focus with the first ticket, on its handle in Done, as the group leaves', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    const reviewed = await screen.findByRole('region', { name: 'Reviewed' });
    within(reviewed).getByRole('button', { name: 'Move 3 to Done' }).focus();
    await user.keyboard('{Enter}');
    await readMenuConfirm();
    screen.getByRole('button', { name: 'Move to Done' }).focus();
    await user.keyboard('{Enter}');

    const handle = () => screen.getByRole('button', { name: handleName('MOB-4') });
    await waitFor(() => expect(keysIn('Done')).toEqual(['MOB-4', 'MOB-3', 'MOB-2', 'MOB-5']));
    await waitFor(() => expect(handle()).toHaveFocus());
    expect(within(group('Done')!).getByRole('button', { name: handleName('MOB-4') })).toBe(
      handle(),
    );
  });

  it("keeps focus on the first ticket's handle when Undo puts the group back", async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(board());
    renderProject({ client: server.client });
    const reviewed = await screen.findByRole('region', { name: 'Reviewed' });
    within(reviewed).getByRole('button', { name: 'Move 3 to Done' }).focus();
    await user.keyboard('{Enter}');
    await readMenuConfirm();
    screen.getByRole('button', { name: 'Move to Done' }).focus();
    await user.keyboard('{Enter}');
    const handle = () => screen.getByRole('button', { name: handleName('MOB-4') });
    await waitFor(() => expect(handle()).toHaveFocus());
    await screen.findByRole('button', { name: 'Undo' });

    await user.keyboard('{Meta>}z{/Meta}');

    await waitFor(() => expect(keysIn('Reviewed')).toEqual(['MOB-4', 'MOB-3', 'MOB-2']));
    expect(within(group('Reviewed')!).getByRole('button', { name: handleName('MOB-4') })).toBe(
      handle(),
    );
    await waitFor(() => expect(handle()).toHaveFocus());
    expect(await screen.findByText('3 tickets moved back')).toBeInTheDocument();
    expect(handle()).toHaveFocus();
  });

  describe('on phones', () => {
    beforeEach(() => {
      restore.push(mockPhone(true));
    });

    it("is the group's last row, as the header has no room beside Show less and the +", async () => {
      const user = userEvent.setup();
      const server = fakeBoardServer(board());
      renderProject({ client: server.client });
      const reviewed = await screen.findByRole('region', { name: 'Reviewed' });
      const row = within(reviewed).getByRole('button', { name: 'Move 3 to Done' });
      expect(reviewed.lastElementChild).toBe(row);

      await user.click(row);
      const sheet = screen.getByRole('dialog', { name: 'Move to Done' });
      await readActionSheet();
      await user.click(within(sheet).getByRole('button', { name: 'Move 3 to Done' }));
      await waitFor(() => expect(keysIn('Done')).toEqual(['MOB-4', 'MOB-3', 'MOB-2', 'MOB-5']));
      expect(server.client.moveToDone).toHaveBeenCalledTimes(1);
    });
  });
});
