import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { PHONE_QUERY } from '../../src/lib/media';
import { Sheet } from '../../src/overlays';
import { skipAnimations } from '../../src/overlays/testing';

// PT-205: on an iPhone the Connect Claude Code sheet stopped about a keyboard's height above the
// bottom of the screen, with no keyboard up: its body, and the scrolled content in it, ended there
// and the screen behind showed under it. iOS can keep reporting the visual viewport a keyboard
// shortened after the keyboard has gone, and the sheet lifted itself by that and shrank to it.
// Only a field being edited brings the keyboard up, so only then does the sheet follow it. A press
// that takes focus out of the field keeps the sheet up until the release, or the sheet dropped
// under the finger and a tap on Create missed it (the PT-205 review).

const KEYBOARD = 335;

function staleViewport(): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const viewport = Object.assign(new EventTarget(), {
    height: window.innerHeight - KEYBOARD,
    offsetTop: 0,
    scale: 1,
  });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  return () => {
    if (previous) Object.defineProperty(window, 'visualViewport', previous);
    else Reflect.deleteProperty(window, 'visualViewport');
  };
}

function touchPhone(): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const matches = (query: string) => query === PHONE_QUERY || query === '(hover: none)';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matches(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), touchPhone(), staleViewport()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function renderSheet() {
  render(
    <Sheet open onClose={() => undefined} label="New ticket" title="New ticket">
      <input aria-label="Ticket title" />
      <button type="button">Create</button>
    </Sheet>,
  );
  const overlay = document.querySelector<HTMLElement>('[data-sheet]');
  if (!overlay) throw new Error('No sheet.');
  return overlay;
}

const lift = (overlay: HTMLElement) => overlay.style.getPropertyValue('--sheet-keyboard');
const field = () => screen.getByRole('textbox', { name: 'Ticket title' });

it('stays on the bottom of the screen at full height while no field has focus', () => {
  const overlay = renderSheet();
  expect(lift(overlay)).toBe('');
  expect(overlay.style.getPropertyValue('--sheet-viewport')).toBe('');
});

it('still rises above the keyboard while a field in it has focus', () => {
  const overlay = renderSheet();
  act(() => field().focus());
  expect(lift(overlay)).toBe(`${KEYBOARD}px`);
  expect(overlay.style.getPropertyValue('--sheet-viewport')).toBe(
    `${window.innerHeight - KEYBOARD}px`,
  );
  act(() => field().blur());
  expect(lift(overlay)).toBe('');
});

const nextTask = () => act(() => new Promise((resolve) => setTimeout(resolve)));

it('stays up through a click that takes focus out of the field, and drops after it', async () => {
  const overlay = renderSheet();
  act(() => field().focus());
  const create = screen.getByRole('button', { name: 'Create' });
  fireEvent.pointerDown(create);
  fireEvent.mouseDown(create);
  act(() => field().blur());
  expect(lift(overlay)).toBe(`${KEYBOARD}px`);
  fireEvent.pointerUp(create);
  fireEvent.mouseUp(create);
  expect(lift(overlay)).toBe(`${KEYBOARD}px`);
  await nextTask();
  expect(lift(overlay)).toBe('');
});

// A tap's pointer events all come before its mouse events, and its mousedown takes the focus.
it('stays up through a tap that takes focus out of the field, and drops after it', async () => {
  const overlay = renderSheet();
  act(() => field().focus());
  const create = screen.getByRole('button', { name: 'Create' });
  fireEvent.pointerDown(create);
  fireEvent.pointerUp(create);
  fireEvent.mouseDown(create);
  act(() => field().blur());
  expect(lift(overlay)).toBe(`${KEYBOARD}px`);
  fireEvent.mouseUp(create);
  expect(lift(overlay)).toBe(`${KEYBOARD}px`);
  await nextTask();
  expect(lift(overlay)).toBe('');
});
