import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Label } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { getListView, resetListView } from './listViewStore';
import { renderProject } from './test/renderProject';

vi.mock('../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

const label = (id: string, name: string, position: number): Label => ({
  id,
  projectId: 'p1',
  name,
  color: '#B42318',
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});

const bug = label('l-bug', 'Bug', 0);

const labelledBoard = () => ({
  ...makeBoard([
    listItem(1, STATUS.todo, 0, { title: 'Crash on rotate', labelIds: ['l-bug'] }),
    listItem(2, STATUS.todo, 1, { title: 'Dark mode' }),
    listItem(3, STATUS.done, 0, { title: 'Login fails', labelIds: ['l-bug'] }),
  ]),
  labels: [bug, label('l-ui', 'UI', 1)],
});

const rowKeys = () =>
  screen
    .getAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

describe('the label filter', () => {
  it('narrows the list to a label, with the status tab and the search, and goes back to all', async () => {
    const user = userEvent.setup();
    renderProject({ board: labelledBoard() });
    await screen.findByRole('region', { name: 'To do' });
    expect(rowKeys()).toEqual(['MOB-1', 'MOB-2', 'MOB-3']);
    await user.click(screen.getByRole('button', { name: 'Filter by label' }));
    const menu = screen.getByRole('listbox', { name: 'Label' });
    expect(
      within(menu)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All labels', 'Bug', 'UI']);
    await user.click(within(menu).getByRole('option', { name: 'Bug' }));
    expect(rowKeys()).toEqual(['MOB-1', 'MOB-3']);
    expect(getListView('MOB').label).toBe('l-bug');
    await user.type(screen.getByLabelText('Search tickets'), 'login');
    expect(rowKeys()).toEqual(['MOB-3']);
    await user.clear(screen.getByLabelText('Search tickets'));
    await user.click(screen.getByRole('button', { name: 'Label Bug' }));
    await user.click(screen.getByRole('option', { name: 'All labels' }));
    expect(rowKeys()).toEqual(['MOB-1', 'MOB-2', 'MOB-3']);
  });

  it('shows the labels on the rows', async () => {
    renderProject({ board: labelledBoard() });
    const row = await screen.findByRole('button', { name: /^MOB-1/ });
    expect(row).toHaveTextContent('Bug');
    expect(screen.getByRole('button', { name: /^MOB-2/ })).not.toHaveTextContent('Bug');
  });

  it('is left out of a project without labels', async () => {
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    expect(screen.queryByRole('button', { name: 'Filter by label' })).toBeNull();
  });
});
