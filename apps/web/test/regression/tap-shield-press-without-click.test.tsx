import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscardChangesSheet } from '../../src/overlays/DiscardChangesSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// PT-97: an action sheet takes a mouse's single click at once, and tells a mouse by the
// pointerdown before the click (useTapShield). It forgot that pointer only on a click, so a press
// that ended without one (dragged off the row, or dragging the sheet down) left "mouse" behind,
// and a later click with no pointer press of its own, such as VoiceOver's, went through at once.

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

// What a click with no pointer before it would find comes after the press's own task.
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('regression: a mouse press that ends without a click is forgotten', () => {
  it('holds a click without a pointer after a mouse press dragged off the row', async () => {
    const { onDiscard, row } = renderDiscard();

    fireEvent.pointerDown(row, { pointerType: 'mouse' });
    fireEvent.pointerUp(document.body, { pointerType: 'mouse' });
    await nextTask();
    fireEvent.click(row, { detail: 1 });

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('holds a click without a pointer after a mouse press the browser cancelled', async () => {
    const { onDiscard, row } = renderDiscard();

    fireEvent.pointerDown(row, { pointerType: 'mouse' });
    fireEvent.pointerCancel(row, { pointerType: 'mouse' });
    await nextTask();
    fireEvent.click(row, { detail: 1 });

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('still takes the click a mouse press makes, right after its pointerup', () => {
    const { onDiscard, row } = renderDiscard();

    fireEvent.pointerDown(row, { pointerType: 'mouse' });
    fireEvent.mouseDown(row, { detail: 1 });
    fireEvent.pointerUp(row, { pointerType: 'mouse' });
    fireEvent.mouseUp(row, { detail: 1 });
    fireEvent.click(row, { detail: 1 });

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
