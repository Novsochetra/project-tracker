import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { ProjectOptionsButton } from '../../src/features/projects/ProjectOptionsButton';
import { ItemMenu } from '../../src/features/ticket/activity/ItemMenu';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';
import { doubleClick, GAPS } from './doubleClick';
import { advance, stillClock } from './stillClock';

// PT-82: double-clicking Delete project in the desktop ••• menu closed the menu instead of keeping
// its confirm (Chromium and WebKit, 1280×800). Delete project is the last of four items, and the
// confirm that takes the menu's place is shorter, so the second click landed below it, on the
// layer that closes the menu on a click outside. jsdom has no layout: the spot's item is gone, so
// the second click goes to that layer.

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
});

function renderProjectMenu() {
  const deleteProject = vi.fn(() => Promise.resolve());
  renderWithApp(<ProjectOptionsButton projectKey="MOB" placement="header" />, {
    path: '/p/MOB',
    client: { deleteProject },
    projects: [projectSummary({ totalCount: 4 })],
  });
  restore.push(stillClock());
  return { user: userEvent.setup(), deleteProject };
}

const confirm = () => screen.queryByRole('alert');
const closeLayer = () => screen.getByRole('button', { name: 'Close menu', hidden: true });

describe('regression: a double-click on Delete project keeps its confirm', () => {
  it.each(GAPS)('the second click beside the confirm leaves it open (%i ms apart)', async (gap) => {
    const { user, deleteProject } = renderProjectMenu();
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    const item = screen.getByRole('button', { name: 'Delete project' });

    await doubleClick(user, item, document.body, gap);

    expect(confirm()).toHaveTextContent('Delete this project and its 4 tickets?');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it('closes on a click outside once the double-click is over', async () => {
    const { user } = renderProjectMenu();
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await advance(CLICK_SHIELD_MS);

    await user.click(closeLayer());

    expect(confirm()).not.toBeInTheDocument();
  });

  it('still closes at once on a click outside a menu that shows no confirm', async () => {
    const { user } = renderProjectMenu();
    await user.click(screen.getByRole('button', { name: 'Project options' }));

    await user.click(closeLayer());

    expect(screen.getByRole('button', { name: 'Project options' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('holds the layer under a comment menu’s confirm too', async () => {
    const onDelete = vi.fn();
    renderWithApp(<ItemMenu noun="comment" onEdit={vi.fn()} onDelete={onDelete} />);
    restore.push(stillClock());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    const item = screen.getByRole('button', { name: 'Delete comment' });

    await doubleClick(user, item, document.body, 120);

    expect(confirm()).toHaveTextContent("Delete this comment? This can't be undone.");
    expect(onDelete).not.toHaveBeenCalled();
  });
});
