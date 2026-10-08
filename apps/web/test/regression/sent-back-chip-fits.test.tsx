import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS, statuses } from '../../src/api/test/fixtures';
import { DragGhost } from '../../src/features/project/dnd/DragGhost';
import type { RowCallbacks } from '../../src/features/project/rowTypes';
import { TicketRowContent } from '../../src/features/project/TicketRowContent';
import { phoneRule, phoneStyle, pixels } from './phoneCss';

const ROW = 'features/project/TicketRow.module.css';
const GHOST = 'features/project/dnd/DragGhost.module.css';
const CHIP = 'components/VerdictChip/VerdictChip.module.css';
const AVATAR = 'components/Avatar/Avatar.module.css';
const SCREEN = 'features/project/ProjectScreen.module.css';
// "MOB-18" in 12px Geist Mono and "Oct 9" in 12px Geist, measured in WebKit.
const KEY_TEXT = 43.2;
const DUE_TEXT = 30.1;
const ICON = 14;
// The full chip, "Changes requested" with its icon, measured in WebKit: too wide for this line.
const FULL_CHIP = 143.5;

const ticket = listItem(18, STATUS.todo, 0, {
  title: 'Long list idea number 18 with a reasonably descriptive title',
  priority: 'high',
  due: '2026-10-09',
  assignee: 'Claude',
  lastReview: { verdict: 'changes_requested', rating: 2 },
});

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  confirmDelete: vi.fn(),
};

function renderRow() {
  render(
    <TicketRowContent
      ticket={ticket}
      status={statuses[0]!}
      dragged={false}
      callbacks={callbacks}
    />,
  );
  const main = screen.getByRole('button', { name: /^MOB-18/ });
  return {
    main,
    title: screen.getByText(ticket.title),
    key: screen.getByText('MOB-18'),
    due: screen.getByText('Oct 9').closest('span')!,
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
      const due = ICON + pixels(phoneStyle(row.due, ROW, width).get('gap')) + DUE_TEXT;
      const parts = [pixels(row.priority.getAttribute('width') ?? ''), KEY_TEXT, chip, due];
      const gap = columnGap(phoneStyle(row.main, ROW, width));
      const used = parts.reduce((sum, part) => sum + part, 0) + 3 * gap;
      expect(used).toBeLessThanOrEqual(secondLine(row.main, width));
      expect(used - chip + FULL_CHIP).toBeGreaterThan(secondLine(row.main, 375));
    },
  );

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
