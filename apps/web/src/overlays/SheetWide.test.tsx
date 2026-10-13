import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';
import { SheetTextButton } from './SheetButtons';
import { mockPhone, skipAnimations } from './testing';

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function renderWide(onClose = () => undefined) {
  render(
    <Sheet
      open
      onClose={onClose}
      label="Connect"
      title="Connect"
      size="wide"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      <p>Long setup</p>
    </Sheet>,
  );
  return screen.getByText('Long setup').parentElement;
}

describe('Sheet: wide', () => {
  it('focuses its scrolling body on desktop, so Page Down scrolls it at once', () => {
    restore.push(mockPhone(false));
    const body = renderWide();
    expect(body).toHaveFocus();
    expect(body).toHaveAttribute('tabindex', '-1');
  });

  it('still closes on Escape and tabs to its buttons from the body', async () => {
    restore.push(mockPhone(false));
    const onClose = vi.fn();
    renderWide(onClose);
    const user = userEvent.setup();
    await user.tab({ shift: true });
    const dialog = screen.getByRole('dialog', { name: 'Connect' });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the dialog on phones, whose body is not a tab stop', () => {
    restore.push(mockPhone(true));
    const body = renderWide();
    expect(screen.getByRole('dialog', { name: 'Connect' })).toHaveFocus();
    expect(body).not.toHaveAttribute('tabindex');
  });
});
