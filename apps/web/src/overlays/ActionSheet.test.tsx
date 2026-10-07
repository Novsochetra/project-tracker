import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionSheet } from './ActionSheet';
import { mockPhone, skipAnimations } from './testing';

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
    await user.click(screen.getByRole('button', { name: 'Edit project' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('can turn into a confirmation without closing', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ProjectOptions onEdit={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(screen.getByText(/and its 7 tickets/)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Delete project' });
    expect(confirm).toHaveClass('bold');
    await user.click(confirm);
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
