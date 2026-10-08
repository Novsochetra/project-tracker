import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../src/api/test/fixtures';
import { resetListView } from '../../src/features/project/listViewStore';
import { renderProject } from '../../src/features/project/test/renderProject';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

vi.mock('../../src/features/projects/ProjectOptionsButton', () => ({
  ProjectOptionsButton: () => null,
}));

const board = makeBoard([
  listItem(3, STATUS.todo, 0, {
    title: 'Dark mode colors',
    lastReview: { verdict: 'changes_requested', rating: 2 },
  }),
  listItem(4, STATUS.todo, 1000, { title: 'Fresh idea' }),
]);

const ticketButton = (key: string) =>
  within(screen.getByRole('region', { name: 'To do' })).getByRole('button', {
    name: new RegExp(`^${key}\\b`),
  });

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  window.localStorage.clear();
});

// A reviewer's "Changes requested" puts the ticket at the top of To do, where it looked exactly
// like a new idea in the list and on the board: only the Projects screen read lastReview.
describe('regression: a sent-back ticket is marked on the Project screen', () => {
  it('shows "Changes requested" on its row and its board card, and nothing on a new idea', async () => {
    const user = userEvent.setup();
    renderProject({ board });
    await screen.findByRole('region', { name: 'To do' });
    expect(ticketButton('MOB-3')).toHaveAccessibleName(/Changes requested/);
    expect(ticketButton('MOB-4')).not.toHaveAccessibleName(/Changes requested/);

    const views = screen.getByRole('group', { name: 'Show tickets as' });
    await user.click(within(views).getByRole('button', { name: 'Board' }));
    expect(ticketButton('MOB-3')).toHaveTextContent('Changes requested');
    expect(ticketButton('MOB-4')).not.toHaveTextContent('Changes requested');
  });
});
