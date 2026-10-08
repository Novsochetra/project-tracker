import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscardChangesSheet } from '../../src/overlays/DiscardChangesSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// PT-82: on desktop "Discard changes?" is an action sheet, and its rows ignored every mouse click
// for 500 ms after it appeared, also a single click a person aimed at Discard changes. Only a
// double-click's later clicks, touch or pen taps and clicks without a pointer can land on a row
// that has just arrived under them.

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
});

function renderDiscard() {
  const onDiscard = vi.fn();
  render(<DiscardChangesSheet open onKeep={vi.fn()} onDiscard={onDiscard} />);
  return { onDiscard, row: screen.getByRole('button', { name: 'Discard changes' }) };
}

describe('regression: desktop Discard changes takes a mouse click at once', () => {
  it('discards on a single mouse click right after the sheet appears', async () => {
    const { onDiscard, row } = renderDiscard();

    await userEvent.setup().click(row);

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('still holds a touch tap right after the sheet appears', async () => {
    const { onDiscard, row } = renderDiscard();

    await userEvent.setup().pointer({ keys: '[TouchA]', target: row });

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('still holds the second click of a double-click that opened the sheet', () => {
    const { onDiscard, row } = renderDiscard();

    fireEvent.pointerDown(row, { pointerType: 'mouse' });
    fireEvent.mouseDown(row, { detail: 2 });
    fireEvent.click(row, { detail: 2 });

    expect(onDiscard).not.toHaveBeenCalled();
  });
});
