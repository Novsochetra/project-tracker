import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SwipeActions } from '../../src/gestures/SwipeActions';
import { skipAnimations } from '../../src/overlays/testing';

// PT-261 gave ticket rows a third swipe-left action (Status, Labels, Delete). Open, they take
// 228px, past the full-swipe point of 55% of a phone row (189px at 375, 158px at 320), so the
// resting open row was already a full swipe: opening it, or nudging it to close, picked Status.

function drag(target: Element, from: number, dx: number) {
  const base = { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientY: 20 };
  fireEvent.pointerDown(target, { ...base, clientX: from });
  fireEvent.pointerMove(target, { ...base, clientX: from + dx / 2 });
  fireEvent.pointerMove(target, { ...base, clientX: from + dx });
  fireEvent.pointerUp(target, { ...base, clientX: from + dx });
}

let restore: () => void = () => undefined;

function renderRow(rowWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: rowWidth,
    bottom: 52,
    width: rowWidth,
    height: 52,
    toJSON: () => ({}),
  });
  const status = vi.fn();
  render(
    <SwipeActions
      trailing={[
        { label: 'Status', tone: 'neutral', onTrigger: status },
        { label: 'Labels', tone: 'dark', onTrigger: vi.fn() },
        { label: 'Delete', tone: 'danger', onTrigger: vi.fn() },
      ]}
    >
      <button type="button">MOB-1</button>
    </SwipeActions>,
  );
  const button = screen.getByRole('button', { name: 'MOB-1' });

  return { status, row: button.closest('div')!, root: button.parentElement!.parentElement! };
}

beforeEach(() => {
  restore = skipAnimations();
});

afterEach(() => {
  restore();
  vi.restoreAllMocks();
});

describe('a row with three swipe actions', () => {
  it.each([343, 288])('opens at %dpx without picking Status, and closes on a nudge', (width) => {
    const { status, row, root } = renderRow(width);
    drag(row, width - 10, -228);
    expect(status).not.toHaveBeenCalled();
    expect(root).toHaveAttribute('data-swipe-open', 'trailing');
    drag(row, width - 240, 20);
    expect(status).not.toHaveBeenCalled();
  });

  it.each([343, 288])('still opens on a slow release a little past it at %dpx', (width) => {
    const { status, row, root } = renderRow(width);
    drag(row, width - 10, -240);
    expect(status).not.toHaveBeenCalled();
    expect(root).toHaveAttribute('data-swipe-open', 'trailing');
  });
});
