import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { DURATION } from '../../src/design/motion';
import { ChatOptionsSheet } from '../../src/features/ask/ChatOptionsSheet';
import { ProjectOptionsButton } from '../../src/features/projects/ProjectOptionsButton';
import { ItemMenu } from '../../src/features/ticket/activity/ItemMenu';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';
import { GAPS, type User } from './doubleClick';
import { advance, stillClock } from './stillClock';

// On phones a double tap on Delete comment deleted the comment without a real confirm (WebKit,
// iPhone 13 at 375×812): the action sheet turned into its confirm, whose Delete row took the place
// of Delete comment, under the second tap 0–200 ms later. Delete report, Delete review and Delete
// project did the same. jsdom has no layout, so each test taps the row the browser found there.

// A deleted comment, report or review leaves after the sheet's exit.
const afterExit = () => advance(DURATION.sheetOut);

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
});

async function doubleTap(user: User, first: string, second: string, gap: number) {
  await tap(user, screen.getByRole('button', { name: first }));
  if (gap > 0) await advance(gap);
  await tap(user, screen.getByRole('button', { name: second }));
}

async function openItemSheet(noun: string) {
  const onDelete = vi.fn();
  const onEdit = noun === 'comment' ? vi.fn() : undefined;
  renderWithApp(<ItemMenu noun={noun} onEdit={onEdit} onDelete={onDelete} />);
  restore.push(stillClock());
  const user = userEvent.setup();
  const name = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} options`;
  await user.click(screen.getByRole('button', { name }));
  // A person reads the sheet before tapping one of its rows.
  await advance(CLICK_SHIELD_MS);
  return { user, onDelete };
}

const CASES = ['comment', 'report', 'review'].flatMap((noun) =>
  GAPS.map((gap) => [noun, gap] as const),
);

describe('regression: a double tap on Delete in an action sheet never confirms the delete', () => {
  it.each(CASES)('Delete %s keeps its confirm (%i ms apart)', async (noun, gap) => {
    const { user, onDelete } = await openItemSheet(noun);
    await doubleTap(user, `Delete ${noun}`, 'Delete', gap);
    await afterExit();
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent(
      `Delete this ${noun}? This can't be undone.`,
    );
  });

  it.each(GAPS)('Delete project keeps its confirm (%i ms apart)', async (gap) => {
    const deleteProject = vi.fn(() => Promise.resolve());
    renderWithApp(<ProjectOptionsButton projectKey="MOB" placement="navbar" />, {
      path: '/p/MOB',
      client: { deleteProject },
      projects: [projectSummary({ totalCount: 4 })],
    });
    restore.push(stillClock());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await advance(CLICK_SHIELD_MS);
    await doubleTap(user, 'Delete project', 'Delete project', gap);
    expect(deleteProject).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('and its 4 tickets?');
  });

  it.each(GAPS)('Delete chat keeps its confirm (%i ms apart)', async (gap) => {
    const deleteChat = vi.fn(() => Promise.resolve());
    renderWithApp(<ChatOptionsSheet projectKey="MOB" chatId="c-1" title="Sync?" />, {
      path: '/p/MOB/ask/c-1',
      client: { deleteChat },
    });
    restore.push(stillClock());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Chat options' }));
    await advance(CLICK_SHIELD_MS);
    await doubleTap(user, 'Delete chat', 'Delete chat', gap);
    expect(deleteChat).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Delete this chat?');
  });

  it('deletes on a tap once the double tap is over', async () => {
    const { user, onDelete } = await openItemSheet('comment');
    await tap(user, screen.getByRole('button', { name: 'Delete comment' }));
    await advance(CLICK_SHIELD_MS);
    await tap(user, screen.getByRole('button', { name: 'Delete' }));
    await afterExit();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('deletes from the keyboard at once', async () => {
    const { user, onDelete } = await openItemSheet('comment');
    await user.click(screen.getByRole('button', { name: 'Delete comment' }));
    screen.getByRole('button', { name: 'Delete' }).focus();
    await user.keyboard('{Enter}');
    await afterExit();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
