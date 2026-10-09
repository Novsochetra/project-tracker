import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ActionSheet } from '../../src/overlays/ActionSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// PT-117: when an action sheet's rows scroll, how much of the row below shows depended on the
// screen's height. At 874×296 (an iPhone sideways under Safari's bars, no safe area) the card of
// rows ended 2.5px into Delete project, so the list looked complete until scrolled. The card now
// ends about halfway through a row. Geometry as measured in WebKit at that size.

const CARD_TOP = 8;
const CARD_HEIGHT = 216;
const CAPTION = 45.5;
const ROW = 56;
const LABELS = ['Edit project', 'Manage statuses', 'Connect Claude Code', 'Delete project'];

let restore: Array<() => void> = [];

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
  restore = [skipAnimations(), mockPhone(true)];
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.getAttribute('role') === 'presentation') return rect(CARD_TOP, CARD_HEIGHT);
    const row = LABELS.indexOf(this.textContent ?? '');
    if (this.tagName === 'BUTTON' && row >= 0) return rect(CARD_TOP + CAPTION + row * ROW, ROW);
    return rect(0, 0);
  });
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.restoreAllMocks();
});

it('ends a card of rows that scrolls about halfway through a row', () => {
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
  const height = Number.parseFloat(card.style.maxHeight);
  const connectTop = CAPTION + 2 * ROW;
  expect((height - connectTop) / ROW).toBeGreaterThan(0.4);
  expect((height - connectTop) / ROW).toBeLessThan(0.6);
});
