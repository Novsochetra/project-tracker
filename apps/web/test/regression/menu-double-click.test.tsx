import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditProjectSheet } from '../../src/app/lazyParts';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { ProjectOptionsButton } from '../../src/features/projects/ProjectOptionsButton';
import { ItemMenu } from '../../src/features/ticket/activity/ItemMenu';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';
import { doubleClick, GAPS, hitTest } from './doubleClick';
import { advance, stillClock } from './stillClock';

// Double-clicking Edit project in the ••• menu opened its sheet, and the second click went through
// the closing menu to the sheet's backdrop and closed the sheet again (Chromium and WebKit,
// 1280×800). The menu and its click-catching layer went at once, so in the comment and report
// menus the second click reached what lay under them too.

let restore: Array<() => void> = [];

// Edit project loads when opened; this is about the second click, not its loading.
beforeAll(() => EditProjectSheet.preload());

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
});

describe('regression: the second click of a double-click stays on the ••• menu', () => {
  const editSheet = () => screen.queryByRole('dialog', { name: 'Edit project' });
  // The dimmed area around the sheet is the "Close" button outside its dialog.
  const backdrop = () =>
    screen
      .getAllByRole('button', { name: 'Close' })
      .find((button) => !editSheet()?.contains(button))!;

  it.each(GAPS)('Edit project keeps its sheet open (%i ms apart)', async (gap) => {
    renderWithApp(
      <SheetsProvider>
        <ProjectOptionsButton projectKey="MOB" placement="header" />
      </SheetsProvider>,
      { path: '/p/MOB', projects: [projectSummary()] },
    );
    restore.push(stillClock());
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Project options' });
    await user.click(trigger);
    const item = screen.getByRole('button', { name: 'Edit project' });
    await user.click(item);
    expect(editSheet()).toBeInTheDocument();
    if (gap > 0) await advance(gap);
    await user.click(hitTest(item, backdrop()));
    expect(editSheet()).toBeInTheDocument();
  });

  // Like a comment card: the ••• button hides while the comment is being edited.
  function Comment({ onEdit, onOpen }: { onEdit: () => void; onOpen: () => void }) {
    const [editing, setEditing] = useState(false);
    return (
      <>
        <ItemMenu
          noun="comment"
          hidden={editing}
          onEdit={() => {
            onEdit();
            setEditing(true);
          }}
          onDelete={vi.fn()}
        />
        <button type="button" onClick={onOpen}>
          Open MOB-4
        </button>
      </>
    );
  }

  function renderCommentMenu() {
    const onEdit = vi.fn();
    const onOpen = vi.fn();
    renderWithApp(<Comment onEdit={onEdit} onOpen={onOpen} />);
    restore.push(stillClock());
    const below = screen.getByRole('button', { name: 'Open MOB-4' });
    return { user: userEvent.setup(), onEdit, onOpen, below };
  }

  it.each(GAPS)('Edit comment never clicks what is under it (%i ms apart)', async (gap) => {
    const { user, onEdit, onOpen, below } = renderCommentMenu();
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    await doubleClick(user, screen.getByRole('button', { name: 'Edit comment' }), below, gap);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('lets clicks through again once a double-click is over', async () => {
    const { user, onOpen, below } = renderCommentMenu();
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    const item = screen.getByRole('button', { name: 'Edit comment' });
    await user.click(item);
    await advance(CLICK_SHIELD_MS);
    expect(hitTest(item, below)).toBe(below);
    await user.click(below);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
