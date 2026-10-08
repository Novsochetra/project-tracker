import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';
import { SheetCancelButton } from './SheetButtons';
import { mockPhone, readActionSheet, skipAnimations } from './testing';

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTitle('');
          setOpen(true);
        }}
      >
        Open
      </button>
      <Sheet
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        label="New ticket"
        title="New ticket"
        left={<SheetCancelButton />}
        dirty={title.trim() !== ''}
      >
        <input
          aria-label="Ticket title"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </Sheet>
    </>
  );
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

async function openSheet(isPhone: boolean) {
  restore.push(mockPhone(isPhone));
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<Harness onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  return { onClose, user };
}

const sheet = () => screen.getByRole('dialog', { name: 'New ticket' });
const grabArea = () => within(sheet()).getByText('New ticket');
const titleField = () => screen.getByRole('textbox', { name: 'Ticket title' });
const opener = () => screen.getByRole('button', { name: 'Open' });
const confirm = () => screen.queryByRole('dialog', { name: 'Discard changes?' });
// The dimmed area around the sheet is the "Close" button outside its dialog.
const scrim = () =>
  within(sheet().parentElement!)
    .getAllByRole('button', { name: 'Close' })
    .find((button) => !sheet().contains(button))!;

const touch = { pointerId: 5, pointerType: 'touch', isPrimary: true, button: 0, clientX: 120 };

function pullDown(target: Element, distance: number) {
  fireEvent.pointerDown(target, { ...touch, clientY: 100 });
  fireEvent.pointerMove(target, { ...touch, clientY: 100 + distance / 2 });
  fireEvent.pointerMove(target, { ...touch, clientY: 100 + distance });
}

function release(target: Element, distance: number) {
  fireEvent.pointerUp(target, { ...touch, clientY: 100 + distance });
}

function swipeDown(target: Element, distance = 400) {
  pullDown(target, distance);
  release(target, distance);
}

const offsetOf = (element: HTMLElement): number => {
  const match = /translateY\((-?[\d.]+)px\)/.exec(element.style.transform);
  return match ? Number(match[1]) : 0;
};

describe('Sheet with unsaved changes on phones', () => {
  it('springs back from a swipe-down past the threshold and asks before discarding', async () => {
    const { onClose, user } = await openSheet(true);
    await user.type(titleField(), 'Half-typed idea');
    pullDown(grabArea(), 400);
    await waitFor(() => expect(offsetOf(sheet())).toBe(400));
    release(grabArea(), 400);

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    await waitFor(() => expect(offsetOf(sheet())).toBe(0));
    expect(onClose).not.toHaveBeenCalled();
    const choices = within(confirm()!)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(choices).toEqual(['Discard changes', 'Keep editing']);
    expect(within(confirm()!).getByRole('button', { name: 'Discard changes' })).toHaveClass(
      'danger',
    );
  });

  it('keeps the text and the focus with Keep editing', async () => {
    const { onClose, user } = await openSheet(true);
    await user.type(titleField(), 'Half-typed idea');
    swipeDown(grabArea());
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));

    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(titleField()).toHaveValue('Half-typed idea');
    expect(titleField()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes with Discard changes', async () => {
    const { onClose, user } = await openSheet(true);
    await user.type(titleField(), 'Half-typed idea');
    swipeDown(grabArea());
    await screen.findByRole('button', { name: 'Discard changes' });
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('asks when the scrim is tapped or Cancel is pressed', async () => {
    const { onClose, user } = await openSheet(true);
    await user.type(titleField(), 'Half-typed idea');
    await user.click(scrim());
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());

    await user.click(within(sheet()).getByRole('button', { name: 'Cancel' }));
    expect(confirm()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes at once without changes', async () => {
    const { onClose, user } = await openSheet(true);
    await user.type(titleField(), '   ');
    swipeDown(grabArea());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirm()).not.toBeInTheDocument();
  });
});

describe('Sheet with unsaved changes on desktop', () => {
  it('asks on Escape; Escape again keeps editing with the focus back in the field', async () => {
    const { onClose, user } = await openSheet(false);
    await user.type(titleField(), 'Half-typed idea');
    await user.keyboard('{Escape}');
    expect(confirm()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(sheet()).toBeInTheDocument();
    expect(titleField()).toHaveValue('Half-typed idea');
    expect(titleField()).toHaveFocus();
  });

  it('asks on a click outside and keeps the focus in the field', async () => {
    const { onClose, user } = await openSheet(false);
    await user.type(titleField(), 'Half-typed idea');
    await user.click(scrim());
    expect(confirm()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(confirm()).not.toBeInTheDocument());
    expect(titleField()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Discard changes, gives the focus back and opens fresh next time', async () => {
    const { onClose, user } = await openSheet(false);
    await user.type(titleField(), 'Half-typed idea');
    await user.keyboard('{Escape}');
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener()).toHaveFocus();

    await user.click(opener());
    expect(titleField()).toHaveValue('');
    expect(confirm()).not.toBeInTheDocument();
  });

  it('closes at once from the Cancel button, which is a deliberate click', async () => {
    const { onClose, user } = await openSheet(false);
    await user.type(titleField(), 'Half-typed idea');
    await user.click(within(sheet()).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirm()).not.toBeInTheDocument();
  });

  it('closes at once on Escape and a click outside without changes', async () => {
    const { onClose, user } = await openSheet(false);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(opener());
    await user.click(scrim());
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(confirm()).not.toBeInTheDocument();
  });
});
