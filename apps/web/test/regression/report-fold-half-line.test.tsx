import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// PT-73's review: a long report folded to eight of the card's 21px lines (168px), but its text
// runs on 20px lines (12.5px mono at 1.6), so 8.4 lines showed and the ninth was cut through the
// middle under the fade. The fold now ends where a line of the text itself ends.

const CARD_LINE = '21px';
const LINE = 20;
const LINES = 30;
// A line's text box: the glyphs, inside the line's 20px with 2px of leading above and below.
const lineBox = (index: number) => new DOMRect(0, index * LINE + 2, 300, LINE - 4);

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  const heights = vi
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('text') ? LINES * LINE : 0;
    });
  // jsdom lays out no text; every text node of the report says it spans the same 30 lines.
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => Array.from({ length: LINES }, (_, index) => lineBox(index)),
  });
  document.body.style.lineHeight = CARD_LINE;
  cleanups = [
    () => document.body.style.removeProperty('line-height'),
    skipAnimations(),
    () => heights.mockRestore(),
    () => Reflect.deleteProperty(Range.prototype, 'getClientRects'),
  ];
});

afterEach(() => cleanups.forEach((undo) => undo()));

it('folds a long report after its eighth line, not through the ninth', () => {
  const text = Array.from({ length: LINES }, (_, n) => `Checked case ${n + 1}.`).join('\n');
  const report = comment('r1', text, {
    type: 'report',
    actor: { kind: 'agent', name: 'Claude' },
    createdAt: Date.now(),
  });
  const detail = makeTicketDetail(undefined, { activity: [report] });
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
  const card = within(screen.getByRole('region', { name: 'Activity' }))
    .getByText('Claude report')
    .closest('article')!;
  const more = within(card).getByRole('button', { name: 'Show more' });
  const box = document.getElementById(more.getAttribute('aria-controls')!)!;
  const height = Number.parseFloat(box.style.maxHeight);
  const ends = Array.from({ length: LINES }, (_, index) => lineBox(index).bottom);
  expect(ends).toContain(height);
  expect(height).toBe(lineBox(7).bottom);
});
