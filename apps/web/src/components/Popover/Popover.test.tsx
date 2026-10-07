import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PenLine, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MenuItem } from './MenuItem';
import { Popover } from './Popover';

function Harness({ onEdit }: { onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      aria-label="Project options"
      trigger={
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          Options
        </button>
      }
    >
      <MenuItem icon={PenLine} onClick={onEdit}>
        Edit project
      </MenuItem>
      <MenuItem icon={Trash2} tone="danger">
        Delete project
      </MenuItem>
    </Popover>
  );
}

describe('Popover', () => {
  it('opens a labelled group of items', async () => {
    const onEdit = vi.fn();
    render(<Harness onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('group', { name: 'Project options' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete project' })).toHaveClass('danger');
    await userEvent.click(screen.getByRole('button', { name: 'Edit project' }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('closes on a click outside', async () => {
    render(<Harness onEdit={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Options' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness onEdit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Edit project' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Options' })).toHaveFocus();
  });
});
