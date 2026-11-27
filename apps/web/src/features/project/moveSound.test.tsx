import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { mockPhone, readActionSheet, skipAnimations } from '../../overlays/testing';
import { playMoveSound, playSound } from '../../sound/play';
import { dropRowOf } from './dnd/dropRow';
import { resetListView } from './listViewStore';
import { fakeBoardServer } from './test/fakeBoardServer';
import { renderProject } from './test/renderProject';

vi.mock('../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));
vi.mock('../../sound/play', () => ({ playSound: vi.fn(), playMoveSound: vi.fn() }));

function swipeAction(key: string, label: string) {
  const row = dropRowOf(screen.getByRole('button', { name: new RegExp(`^${key}\\b`) }));
  const action = row && within(row).getByText(label).closest('button');
  if (!action) throw new Error(`No ${label} action on ${key}`);
  fireEvent.click(action);
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
  vi.mocked(playSound).mockClear();
  vi.mocked(playMoveSound).mockClear();
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  window.localStorage.clear();
});

describe('moving a ticket sounds', () => {
  it('chimes when a person picks Done, after the sheet came up and went', async () => {
    const user = userEvent.setup();
    const server = fakeBoardServer(makeBoard([listItem(1, STATUS.todo, 0)]));
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'To do' });

    swipeAction('MOB-1', 'Status');
    const sheet = await screen.findByRole('dialog', { name: 'Status' });
    await readActionSheet();
    expect(playSound).toHaveBeenCalledWith('sheetOpen');
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));

    expect(playMoveSound).toHaveBeenCalledWith(expect.objectContaining({ category: 'done' }));
    await waitFor(() => expect(playSound).toHaveBeenCalledWith('sheetClose'));
  });

  it('passes the status of a swipe that moves a ticket on', async () => {
    const server = fakeBoardServer(makeBoard([listItem(1, STATUS.todo, 0)]));
    renderProject({ client: server.client });
    await screen.findByRole('region', { name: 'To do' });

    swipeAction('MOB-1', 'In progress');
    expect(playMoveSound).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'in_progress' }),
    );
  });
});
