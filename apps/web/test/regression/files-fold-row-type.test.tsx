import { screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';
import { edges, phoneRule, phoneStyle } from './phoneCss';

// PT-84, from PT-73's review (PT-3 on a phone): under the folded files, 'Show all 12 files' was
// 13px like every Show more and 'Add files' beside it 16px like the phone's text buttons, with
// baselines about 2px apart: Show more's margins (-4px above, -10px below) fit it under a card's
// text and pushed it 3px down in the row. The row gives both one size and no vertical margins.

const PICKER = 'features/attachments/AttachmentPicker.module.css';
const FOLD = 'components/Fold/Fold.module.css';
const BUTTON = 'components/Button/Button.module.css';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  // Twelve tiles in three rows of four, so the files fold.
  const rows = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const grid = this.closest('.grid.removable');
    const index = [...(grid?.children ?? [])].findIndex((child) => child.contains(this));
    return index < 0
      ? new DOMRect(0, 0, 343, 192)
      : new DOMRect(0, Math.floor(index / 4) * 96, 72, 72);
  });
  cleanups = [skipAnimations(), () => rows.mockRestore()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

it('gives Show all and Add files under the folded files one size and one baseline', () => {
  const files = Array.from({ length: 12 }, (_, index) => attachment(`f${index + 1}`));
  const detail = makeTicketDetail(undefined, { attachments: files });
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
  const showAll = screen.getByRole('button', { name: 'Show all 12 files' });
  const add = screen.getByRole('button', { name: 'Add files' });

  // On their own they differ: Show more's 13px, the phone text button's 16px.
  expect(phoneStyle(showAll, FOLD).get('font-size')).toBe('13px');
  expect(phoneStyle(add, BUTTON).get('font-size')).toBe('16px');

  const row = phoneRule(PICKER, '.foldRow .foldButton');
  expect(showAll).toHaveClass('foldButton');
  expect(add).toHaveClass('foldButton');
  expect(row.get('font-size')).toBe('13px');
  expect(row.get('font-weight')).toBe(phoneStyle(showAll, FOLD).get('font-weight'));
  const [top, , bottom] = edges(phoneStyle(showAll, FOLD).get('margin'));
  expect([top, bottom]).toEqual([-4, -10]);
  expect([row.get('margin-top'), row.get('margin-bottom')]).toEqual(['0', '0']);
  expect(phoneRule(PICKER, '.foldRow').get('align-items')).toBe('center');
});
