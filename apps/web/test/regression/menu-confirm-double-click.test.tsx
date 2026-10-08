import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { ProjectOptionsButton } from '../../src/features/projects/ProjectOptionsButton';
import { ItemMenu } from '../../src/features/ticket/activity/ItemMenu';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';
import { GAPS } from './doubleClick';

// Double-clicking Delete comment or Delete report deleted it without a real confirm (Chromium and
// WebKit, 1280×800). Near the bottom of the screen the menu opens above its button; the first click
// turned it into the taller delete confirm, which was placed again to grow upward, and that put the
// confirm's Delete button where Delete comment had been, under the second click 120–200 ms later.
// jsdom has no layout, so each test clicks the confirm's button the browser found there.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
});

function renderCommentMenu() {
  const onDelete = vi.fn();
  renderWithApp(<ItemMenu noun="comment" onEdit={vi.fn()} onDelete={onDelete} />);
  return { user: userEvent.setup(), onDelete };
}

async function openConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Delete comment' }));
}

const confirmShown = () =>
  expect(screen.getByRole('alert')).toHaveTextContent("Delete this comment? This can't be undone.");

describe('regression: a double-click on Delete in a ••• menu never confirms the delete', () => {
  it.each(GAPS)('Delete comment keeps its confirm (%i ms apart)', async (gap) => {
    const { user, onDelete } = renderCommentMenu();
    await openConfirm(user);
    if (gap > 0) await wait(gap);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();
    confirmShown();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('keeps the confirm when the second click lands on Cancel', async () => {
    const { user } = renderCommentMenu();
    await openConfirm(user);
    await wait(120);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    confirmShown();
  });

  it('deletes on a click once the double-click is over', async () => {
    const { user, onDelete } = renderCommentMenu();
    await openConfirm(user);
    await wait(CLICK_SHIELD_MS);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('deletes from the keyboard at once', async () => {
    const { user, onDelete } = renderCommentMenu();
    await openConfirm(user);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it.each(GAPS)('Delete project keeps its confirm (%i ms apart)', async (gap) => {
    const deleteProject = vi.fn(() => Promise.resolve());
    renderWithApp(<ProjectOptionsButton projectKey="MOB" placement="header" />, {
      path: '/p/MOB',
      client: { deleteProject },
      projects: [projectSummary({ totalCount: 4 })],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    if (gap > 0) await wait(gap);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteProject).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Delete this project and its 4 tickets?');
  });
});
