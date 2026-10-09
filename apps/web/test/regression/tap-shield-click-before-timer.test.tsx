import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscardChangesSheet } from '../../src/overlays/DiscardChangesSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// PT-106: useTapShield forgot a press that ended without a click in a timer after its pointerup.
// A busy page can take a later click first (Chromium, 2 of 3 runs): a click with no pointer of its
// own 5–8 ms after the release, such as VoiceOver's, still found the mouse and went through at once.

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  vi.useRealTimers();
  restore.reverse().forEach((undo) => undo());
});

function renderDiscard() {
  const onDiscard = vi.fn();
  render(<DiscardChangesSheet open onKeep={vi.fn()} onDiscard={onDiscard} />);
  // The timer after a pointerup waits, as on a busy page.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  return { onDiscard, row: screen.getByRole('button', { name: 'Discard changes' }) };
}

describe('regression: a click that comes before the timer after a release', () => {
  it('holds a click with no pointer after a mouse press released off the row', () => {
    const { onDiscard, row } = renderDiscard();

    fireEvent.pointerDown(row, { pointerType: 'mouse' });
    fireEvent.pointerUp(document.body, { pointerType: 'mouse' });
    fireEvent.click(row, { detail: 1 });

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('still takes the click a mouse press makes with its pointerup', () => {
    const { onDiscard, row } = renderDiscard();

    fireEvent.pointerDown(row, { pointerType: 'mouse' });
    fireEvent.mouseDown(row, { detail: 1 });
    fireEvent.pointerUp(row, { pointerType: 'mouse' });
    fireEvent.mouseUp(row, { detail: 1 });
    fireEvent.click(row, { detail: 1 });

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
