import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionSheet } from './ActionSheet';
import { mockPhone, readActionSheet, skipAnimations, tap } from './testing';

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function ProjectOptions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const close = () => setOpen(false);
  const actions = confirming
    ? [{ label: 'Delete project', tone: 'danger' as const, bold: true, onSelect: onDelete }]
    : [
        { label: 'Edit project', onSelect: () => (onEdit(), close()) },
        { label: 'Delete project', tone: 'danger' as const, onSelect: () => setConfirming(true) },
      ];
  return (
    <ActionSheet
      open={open}
      onClose={close}
      label="Project options"
      caption={
        confirming ? 'Delete “Mobile app” and its 7 tickets? This can’t be undone.' : 'Mobile app'
      }
      actions={actions}
    />
  );
}

describe('ActionSheet', () => {
  it('shows the caption, the actions and a separate Cancel', () => {
    render(<ProjectOptions onEdit={vi.fn()} onDelete={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Project options' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Mobile app')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete project' })).toHaveClass('danger');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('cancel');
  });

  it('runs an action and closes when the action asks to', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<ProjectOptions onEdit={onEdit} onDelete={vi.fn()} />);
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Edit project' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('can turn into a confirmation without closing', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ProjectOptions onEdit={vi.fn()} onDelete={onDelete} />);
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(screen.getByText(/and its 7 tickets/)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Delete project' });
    expect(confirm).toHaveClass('bold');
    await readActionSheet();
    await user.click(confirm);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('takes no taps on its rows right after it opens, while Cancel and the keyboard work', async () => {
    const onEdit = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    const actions = [{ label: 'Edit project', onSelect: onEdit }];
    render(<ActionSheet open onClose={onClose} label="Options" actions={actions} />);
    const edit = screen.getByRole('button', { name: 'Edit project' });
    await tap(user, edit);
    expect(onEdit).not.toHaveBeenCalled();
    edit.focus();
    await user.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledTimes(1);
    await tap(user, screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await readActionSheet();
    await tap(user, edit);
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  it('holds a pen tap and a click with no pointer before it, as VoiceOver’s', () => {
    const onEdit = vi.fn();
    const actions = [{ label: 'Edit project', onSelect: onEdit }];
    render(<ActionSheet open onClose={vi.fn()} label="Options" actions={actions} />);
    const edit = screen.getByRole('button', { name: 'Edit project' });
    fireEvent.pointerDown(edit, { pointerType: 'pen' });
    fireEvent.mouseDown(edit, { detail: 1 });
    fireEvent.click(edit, { detail: 1 });
    fireEvent.click(edit, { detail: 1 });
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('takes a single mouse click at once, but not a double-click’s second click', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    const actions = [{ label: 'Edit project', onSelect: onEdit }];
    render(<ActionSheet open onClose={vi.fn()} label="Options" actions={actions} />);
    const edit = screen.getByRole('button', { name: 'Edit project' });
    await user.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
    await user.dblClick(edit);
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  it('starts the shield again when only the caption changes', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const sheet = (caption: string) => (
      <ActionSheet
        open
        onClose={vi.fn()}
        label="Options"
        caption={caption}
        actions={[{ label: 'Delete', tone: 'danger', onSelect }]}
      />
    );
    const { rerender } = render(sheet('Delete this draft?'));
    await readActionSheet();
    rerender(sheet('Delete this draft and its files?'));
    await tap(user, screen.getByRole('button', { name: 'Delete' }));
    expect(onSelect).not.toHaveBeenCalled();
    await readActionSheet();
    await tap(user, screen.getByRole('button', { name: 'Delete' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('takes no taps on the rows of its next step until they have been there a moment', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ProjectOptions onEdit={vi.fn()} onDelete={onDelete} />);
    await readActionSheet();
    await tap(user, screen.getByRole('button', { name: 'Delete project' }));
    const confirm = screen.getByRole('button', { name: 'Delete project' });
    await tap(user, confirm);
    expect(onDelete).not.toHaveBeenCalled();
    await readActionSheet();
    await tap(user, confirm);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('takes the next step from the keyboard at once', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ProjectOptions onEdit={vi.fn()} onDelete={onDelete} />);
    screen.getByRole('button', { name: 'Delete project' }).focus();
    await user.keyboard('{Enter}');
    screen.getByRole('button', { name: 'Delete project' }).focus();
    await user.keyboard(' ');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('closes with Cancel, the scrim and Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props = { label: 'Options', actions: [], onClose };
    const { rerender } = render(<ActionSheet open {...props} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
    rerender(<ActionSheet open={false} {...props} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
