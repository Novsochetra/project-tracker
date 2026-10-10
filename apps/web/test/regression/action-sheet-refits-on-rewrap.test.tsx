import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ActionSheet } from '../../src/overlays/ActionSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// PT-129: the card of rows was fitted to end halfway through a row when it opened, again on a next
// step and when the window changed size, but not when its rows did: a caption that rewraps as the
// web font arrives moved every row down, and the card then ended near a row line. Geometry of the
// project ••• sheet at 874×296 in WebKit, its caption one line and then two.

const CARD_TOP = 8;
const CARD_HEIGHT = 216;
const ROW = 56;
const LABELS = ['Edit project', 'Manage statuses', 'Connect Claude Code', 'Delete project'];

let caption = 45.5;
let restore: Array<() => void> = [];
const observers = new Set<FakeResizeObserver>();

class FakeResizeObserver {
  constructor(readonly callback: ResizeObserverCallback) {}
  observe() {
    observers.add(this);
  }
  unobserve() {}
  disconnect() {
    observers.delete(this);
  }
}

function rect(top: number, height: number): DOMRect {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
  } as DOMRect;
}

beforeEach(() => {
  caption = 45.5;
  restore = [skipAnimations(), mockPhone(true)];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.getAttribute('role') === 'presentation') return rect(CARD_TOP, CARD_HEIGHT);
    const row = LABELS.indexOf(this.textContent ?? '');
    if (this.tagName === 'BUTTON' && row >= 0) return rect(CARD_TOP + caption + row * ROW, ROW);
    return rect(0, 0);
  });
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  observers.clear();
});

const shareOfConnect = (card: HTMLElement) =>
  (Number.parseFloat(card.style.maxHeight) - (caption + 2 * ROW)) / ROW;

it('fits the card again when its caption rewraps', () => {
  render(
    <ActionSheet
      open
      onClose={vi.fn()}
      label="Project options"
      caption="Mobile app"
      actions={LABELS.map((label) => ({ label, onSelect: vi.fn() }))}
    />,
  );
  const card = screen.getByRole('presentation');
  caption = 63.5;
  act(() => {
    for (const observer of [...observers]) observer.callback([], observer);
  });
  expect(shareOfConnect(card)).toBeGreaterThan(0.4);
  expect(shareOfConnect(card)).toBeLessThan(0.6);
});
