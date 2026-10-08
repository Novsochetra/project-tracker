import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../../src/components/Toast';
import { TOAST_SHIELD_MS } from '../../src/components/Toast/toastStore';

// After Undo the toast's band catches the second tap of a double tap, but in WebKit a second tap in
// the top ~10px of Undo's target still opened the row behind the toast (iPhone 13, 320×568): its
// touch, pointer and touch-end events landed on the band, and WebKit gave its click to the row,
// the nearest element with a click listener of its own. The band takes one while it catches taps.

function Trigger({ undo }: { undo: () => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show('MOB-3 moved to In progress', { undo })}>
      Move
    </button>
  );
}

const addListener = EventTarget.prototype.addEventListener;
const removeListener = EventTarget.prototype.removeEventListener;
let ownClickListeners: Map<EventTarget, Set<unknown>>;

const listenersOf = (target: EventTarget) => ownClickListeners.get(target)?.size ?? 0;

beforeEach(() => {
  vi.useFakeTimers();
  ownClickListeners = new Map();
  vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (
    this: EventTarget,
    ...args: Parameters<EventTarget['addEventListener']>
  ) {
    if (args[0] === 'click') {
      const listeners = ownClickListeners.get(this) ?? new Set();
      ownClickListeners.set(this, listeners.add(args[1]));
    }
    addListener.apply(this, args);
  });
  vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function (
    this: EventTarget,
    ...args: Parameters<EventTarget['removeEventListener']>
  ) {
    if (args[0] === 'click') ownClickListeners.get(this)?.delete(args[1]);
    removeListener.apply(this, args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('gives the band a click listener of its own while it catches taps, and only then', () => {
  const undo = vi.fn();
  render(
    <ToastProvider>
      <Trigger undo={undo} />
    </ToastProvider>,
  );
  const band = screen.getByRole('status');
  fireEvent.click(screen.getByRole('button', { name: 'Move' }));
  expect(listenersOf(band)).toBe(0);

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(undo).toHaveBeenCalledTimes(1);
  expect(band).toHaveClass('shielded');
  expect(listenersOf(band)).toBe(1);
  fireEvent.click(band);
  expect(undo).toHaveBeenCalledTimes(1);

  act(() => void vi.advanceTimersByTime(TOAST_SHIELD_MS));
  expect(band).not.toHaveClass('shielded');
  expect(listenersOf(band)).toBe(0);
});
