import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, useRef, useState, type KeyboardEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';
import { SheetActionButton, SheetTextButton } from './SheetButtons';
import { mockPhone, skipAnimations } from './testing';

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const close = () => {
    onClose();
    setOpen(false);
  };
  const markEscapeHandled = (event: KeyboardEvent) => {
    if (event.key === 'Escape') event.preventDefault();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        New ticket
      </button>
      <Sheet
        open={open}
        onClose={close}
        label="New ticket"
        title="New ticket"
        subtitle="Mobile app"
        left={<SheetTextButton onClick={close}>Cancel</SheetTextButton>}
        right={<SheetActionButton type="submit">Create</SheetActionButton>}
        initialFocusRef={titleRef}
        onSubmit={(event) => event.preventDefault()}
      >
        <input ref={titleRef} aria-label="Ticket title" />
        <input aria-label="Picker" onKeyDown={markEscapeHandled} />
      </Sheet>
    </>
  );
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

async function openSheet(onClose?: () => void) {
  const user = userEvent.setup();
  render(<Harness onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: 'New ticket' }));
  return user;
}

describe('Sheet', () => {
  it('opens as a labelled modal dialog with its header', async () => {
    await openSheet();
    const dialog = screen.getByRole('dialog', { name: 'New ticket' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Mobile app')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('focuses the first field on desktop', async () => {
    await openSheet();
    expect(screen.getByRole('textbox', { name: 'Ticket title' })).toHaveFocus();
  });

  it('focuses the dialog instead of a field on phones', async () => {
    restore.push(mockPhone(true));
    await openSheet();
    expect(screen.getByRole('dialog', { name: 'New ticket' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = await openSheet(onClose);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores an Escape that a control inside already handled', async () => {
    const onClose = vi.fn();
    const user = await openSheet(onClose);
    await user.click(screen.getByRole('textbox', { name: 'Picker' }));
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the scrim is tapped', async () => {
    const onClose = vi.fn();
    const user = await openSheet(onClose);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the sheet', async () => {
    const user = await openSheet();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const picker = screen.getByRole('textbox', { name: 'Picker' });
    await user.click(picker);
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(picker).toHaveFocus();
  });

  it('moves focus in and back under StrictMode double effects', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'New ticket' }));
    expect(screen.getByRole('textbox', { name: 'Ticket title' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'New ticket' })).toHaveFocus();
  });

  it('gives focus back when it closes', async () => {
    const user = await openSheet();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'New ticket' })).toHaveFocus();
  });

  it('stays mounted for the exit animation, then unmounts', async () => {
    MotionGlobalConfig.skipAnimations = false;
    await openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const overlay = document.querySelector('[data-sheet]');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('inert');
    await waitFor(() => expect(document.querySelector('[data-sheet]')).not.toBeInTheDocument());
  });

  it('submits the form from the header action', async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <Sheet open onClose={() => undefined} label="Report" title="Paste report" onSubmit={onSubmit}>
        <SheetActionButton type="submit">Apply</SheetActionButton>
      </Sheet>,
    );
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
