import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS, statuses } from '../../src/api/test/fixtures';
import { DragGhost } from '../../src/features/project/dnd/DragGhost';
import type { RowCallbacks } from '../../src/features/project/rowTypes';
import { TicketRowContent } from '../../src/features/project/TicketRowContent';
import { phoneRule, phoneStyle, pixels } from './phoneCss';

// Reviewer 29 (PT-55): in WebKit at 320×568 a sent-back TRACK-123 due Dec 28 broke its date into
// "Dec / 28" and the row grew from 56 to 70px. This test only modelled MOB-18 due Oct 9.

const ROW = 'features/project/TicketRow.module.css';
const GHOST = 'features/project/dnd/DragGhost.module.css';
const CHIP = 'components/VerdictChip/VerdictChip.module.css';
const AVATAR = 'components/Avatar/Avatar.module.css';
const SCREEN = 'features/project/ProjectScreen.module.css';
const ICON = 14;
// The full chip, "Changes requested" with its icon, measured in WebKit: too wide for this line.
const FULL_CHIP = 143.5;
// The widest dates in 12px Geist, measured in WebKit: "May 20" and, in another year, "May 20, 2030".
const WIDEST_DATE = 41.6;
const WIDEST_DATE_WITH_YEAR = 77.7;
const YEAR = new Date().getFullYear();

// Keys in 12px Geist Mono and dates in 12px Geist, measured in WebKit. TRACK is the longest key a
// project gets (five letters).
const CASES = [
  { key: 'MOB-18', keyText: 43.2, due: '2026-10-09', label: 'Oct 9', dueText: 30.1 },
  { key: 'TRACK-123', keyText: 64.8, due: `${YEAR}-12-28`, label: 'Dec 28', dueText: 39.3 },
];

const sentBack = (key: string, due: string) =>
  listItem(18, STATUS.todo, 0, {
    key,
    title: 'Long list idea number 18 with a reasonably descriptive title',
    priority: 'high',
    due,
    assignee: 'Claude',
    lastReview: { verdict: 'changes_requested', rating: 2 },
  });

const ticket = sentBack('MOB-18', '2026-10-09');

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  confirmDelete: vi.fn(),
};

function renderRow(shown = ticket, label = 'Oct 9') {
  render(
    <TicketRowContent ticket={shown} status={statuses[0]!} dragged={false} callbacks={callbacks} />,
  );
  const main = screen.getByRole('button', { name: new RegExp(`^${shown.key}`) });
  return {
    main,
    title: screen.getByText(shown.title),
    key: screen.getByText(shown.key),
    due: screen.getByText(label).closest('span')!,
    chip: main.querySelector<HTMLElement>('[data-verdict]')!,
    priority: main.querySelector('svg[data-priority]')!,
    avatar: screen.getByRole('img', { name: 'Claude' }),
  };
}

const areaRows = (template = ''): string[][] =>
  [...template.matchAll(/['"]([^'"]*)['"]/g)].map((match) => match[1]!.trim().split(/\s+/));

const columnGap = (style: Map<string, string>) => pixels(style.get('gap')?.split(/\s+/).at(-1));

function padding(style: Map<string, string>, side: 'left' | 'right'): number {
  const longhand = style.get(`padding-${side}`);
  if (longhand) return pixels(longhand);
  const [top = '0', right = top, , left = right] = (style.get('padding') ?? '0').split(/\s+/);
  return pixels(side === 'left' ? left : right);
}

const sides = (style: Map<string, string>) => padding(style, 'left') + padding(style, 'right');

// The second line's room: the phone row inside the page's side padding and the group card's
// 1px borders, minus the row's padding and the avatar's column.
function secondLine(main: Element, width: number): number {
  const groups = document.createElement('div');
  groups.className = 'groups';
  const row = phoneStyle(main, ROW, width);
  const avatar = pixels(phoneRule(AVATAR, '.medium', width).get('width'));
  const inner = width - sides(phoneStyle(groups, SCREEN, width)) - 2 - sides(row);
  return inner - avatar - columnGap(row);
}

// The widths at or below which `@container due` rules hide the calendar icon, by selector.
function iconDropsAt(): Map<string, number> {
  const css = readFileSync(join(import.meta.dirname, '../../src', ROW), 'utf8');
  const rules = css.matchAll(
    /@container due \(max-width: ([\d.]+)px\)\s*{\s*([^{}]+?)\s*{\s*display: none;\s*}\s*}/g,
  );
  return new Map([...rules].map((match) => [match[2]!, Number(match[1])]));
}

const DROPS = iconDropsAt();
const DROPS_AT = DROPS.get('.due svg') ?? Number.NaN;
const DROPS_WITH_YEAR_AT = DROPS.get('.due[data-year] svg') ?? Number.NaN;

describe('the Changes requested chip on a phone row', () => {
  it.each([375, 320])(
    'sits on the second line beside priority, key and due date, and fits at %dpx',
    (width) => {
      const row = renderRow();
      const grid = phoneRule(ROW, '.main:has(.sentBack)', width);
      const [first = [], second = []] = areaRows(grid.get('grid-template-areas'));
      const area = (element: Element) => phoneStyle(element, ROW, width).get('grid-area') ?? '';
      expect(first).toContain(area(row.title));
      expect(second).toEqual([
        area(row.priority),
        area(row.key),
        area(row.chip),
        area(row.due),
        area(row.avatar),
      ]);

      const chip = ICON + sides(phoneRule(CHIP, '.compact', width));
      const due = ICON + pixels(phoneStyle(row.due, ROW, width).get('gap')) + CASES[0]!.dueText;
      const parts = [pixels(row.priority.getAttribute('width') ?? ''), CASES[0]!.keyText, chip];
      const gap = columnGap(phoneStyle(row.main, ROW, width));
      const used = parts.reduce((sum, part) => sum + part, 0) + 3 * gap + due;
      expect(used).toBeLessThanOrEqual(secondLine(row.main, width));
      expect(used - chip + FULL_CHIP).toBeGreaterThan(secondLine(row.main, 375));
    },
  );

  // The due date takes the room the rest of the line leaves; the calendar icon goes when that room
  // is at or below the container's limit, so the date never breaks onto a second line.
  it.each(CASES.flatMap((example) => [375, 320].map((width) => ({ ...example, width }))))(
    'keeps $key due $label on one line at width $width',
    ({ key, keyText, due, label, dueText, width }) => {
      const row = renderRow(sentBack(key, due), label);
      const gap = columnGap(phoneStyle(row.main, ROW, width));
      const chip = ICON + sides(phoneRule(CHIP, '.compact', width));
      const priority = pixels(row.priority.getAttribute('width') ?? '');
      const room = secondLine(row.main, width) - priority - keyText - chip - 3 * gap;
      const withIcon = ICON + pixels(phoneStyle(row.due, ROW, width).get('gap')) + dueText;
      const iconShows = !(room <= DROPS_AT);
      expect(iconShows ? withIcon : dueText).toBeLessThanOrEqual(room);
      if (key === 'TRACK-123' && width === 320)
        expect([withIcon > room, iconShows]).toEqual([true, false]);
      if (key === 'MOB-18') expect(iconShows).toBe(true);
    },
  );

  it('drops the icon only where even the widest date would not fit beside it', () => {
    const iconAndGap = ICON + pixels(phoneRule(ROW, '.due').get('gap'));
    expect(DROPS_AT).toBeGreaterThanOrEqual(iconAndGap + WIDEST_DATE);
    expect(DROPS_AT).toBeLessThan(iconAndGap + WIDEST_DATE + 1);
    expect(DROPS_WITH_YEAR_AT).toBeGreaterThanOrEqual(iconAndGap + WIDEST_DATE_WITH_YEAR);
    expect(DROPS_WITH_YEAR_AT).toBeLessThan(iconAndGap + WIDEST_DATE_WITH_YEAR + 1);
  });

  it('measures the room on phone rows and the phone drag ghost, not on desktop rows', () => {
    for (const width of [375, 320]) {
      expect(phoneRule(ROW, '.main .due', width).get('container')).toBe('due / inline-size');
      expect(phoneRule(GHOST, '.row .due', width).get('container')).toBe('due / inline-size');
    }
    // A flex item sized by its content would shrink to nothing as a size container.
    expect(phoneRule(ROW, '.main .due', 1280).get('container')).toBeUndefined();
    expect(phoneRule(GHOST, '.row .due', 1280).get('container')).toBeUndefined();
  });

  it('marks a date in another year, which is wider', () => {
    const row = renderRow(sentBack('MOB-18', `${YEAR + 1}-05-20`), `May 20, ${YEAR + 1}`);
    expect(row.due).toHaveAttribute('data-year');
    cleanup();
    expect(renderRow().due).not.toHaveAttribute('data-year');
  });

  it('shows only its icon there and keeps the label for screen readers', () => {
    const row = renderRow();
    expect(row.chip).toHaveClass('compact');
    expect(row.main).toHaveAccessibleName(/Changes requested/);
    const label = phoneRule(CHIP, '.compact .label');
    expect(label.get('position')).toBe('absolute');
    expect(label.get('clip')).toBe('rect(0 0 0 0)');
    expect([label.get('width'), label.get('height')]).toEqual(['1px', '1px']);
  });

  it('is no taller than the key’s line, so a sent-back row keeps its height', () => {
    const row = renderRow();
    const chip = pixels(phoneRule(CHIP, '.compact').get('min-height'));
    expect(chip).toBeGreaterThanOrEqual(ICON);
    const key = phoneStyle(row.key, ROW);
    const [size, lineHeight] = /(\d+)px\/([\d.]+)/
      .exec(key.get('font') ?? '')!
      .slice(1)
      .map(Number);
    expect(chip).toBeLessThanOrEqual(size! * lineHeight!);
  });

  it('shows its label on wide desktop rows', () => {
    expect(phoneRule(CHIP, '.compact .label', 1280).size).toBe(0);
  });

  it('is mirrored by the phone drag ghost', () => {
    const origin = { left: 16, top: 200, width: 343 };
    render(
      <DragGhost
        drag={{ ticket, status: statuses[0]!, origin, target: null }}
        ghostRef={() => undefined}
      />,
    );
    const face = screen.getByText(ticket.title).parentElement!;
    const chip = face.querySelector('[data-verdict]')!;
    expect(chip).toHaveTextContent('Changes requested');
    expect(chip).toHaveClass('compact');
    const grid = phoneRule(GHOST, '.row:has(.sentBack)');
    const [, second = []] = areaRows(grid.get('grid-template-areas'));
    expect(second).toContain(phoneStyle(chip, GHOST).get('grid-area'));
    const rowGrid = areaRows(phoneRule(ROW, '.main:has(.sentBack)').get('grid-template-areas'));
    expect(second.slice(1)).toEqual(rowGrid[1]);
  });
});
