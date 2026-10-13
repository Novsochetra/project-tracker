import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Sheet } from '../../src/overlays';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// PT-205: on an iPhone the Connect Claude Code sheet stopped about a keyboard's height above the
// bottom of the screen, with no keyboard up: its body, and the scrolled content in it, ended there
// and the screen behind showed under it. iOS can keep reporting the visual viewport a keyboard
// shortened after the keyboard has gone, and the sheet lifted itself by that and shrank to it.
// Only a focused text field brings the keyboard up, so only then does the sheet follow it.

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

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true), staleViewport()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function renderSheet() {
  render(
    <Sheet open onClose={() => undefined} label="Connect Claude Code" title="Connect Claude Code">
      <input aria-label="Search" />
    </Sheet>,
  );
  const overlay = document.querySelector<HTMLElement>('[data-sheet]');
  if (!overlay) throw new Error('No sheet.');
  return overlay;
}

it('stays on the bottom of the screen at full height while no field has focus', () => {
  const overlay = renderSheet();
  expect(overlay.style.getPropertyValue('--sheet-keyboard')).toBe('');
  expect(overlay.style.getPropertyValue('--sheet-viewport')).toBe('');
});

it('still rises above the keyboard while a field in it has focus', () => {
  const overlay = renderSheet();
  act(() => screen.getByRole('textbox', { name: 'Search' }).focus());
  expect(overlay.style.getPropertyValue('--sheet-keyboard')).toBe(`${KEYBOARD}px`);
  expect(overlay.style.getPropertyValue('--sheet-viewport')).toBe(
    `${window.innerHeight - KEYBOARD}px`,
  );
  act(() => screen.getByRole('textbox', { name: 'Search' }).blur());
  expect(overlay.style.getPropertyValue('--sheet-keyboard')).toBe('');
});
