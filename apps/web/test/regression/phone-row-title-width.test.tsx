import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS, statuses } from '../../src/api/test/fixtures';
import type { RowCallbacks } from '../../src/features/project/rowTypes';
import { TicketRowContent } from '../../src/features/project/TicketRowContent';
import { phoneStyle, pixels } from './phoneCss';

const MODULE = 'features/project/TicketRow.module.css';
// A 375px phone minus the 16px page margins and the group card's 1px borders.
const ROW_WIDTH = 375 - 2 * 16 - 2;

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  confirmDelete: vi.fn(),
};

function renderRow() {
  const ticket = listItem(18, STATUS.todo, 0, {
    title: 'Long list idea number 18 with a reasonably descriptive title',
    priority: 'high',
    due: '2026-10-09',
    assignee: 'Claude',
  });
  render(
    <TicketRowContent
      ticket={ticket}
      status={statuses[0]!}
      dragged={false}
      callbacks={callbacks}
    />,
  );
  const main = screen.getByRole('button', { name: /^MOB-18/ });
  const part = (selector: string) => main.querySelector(selector)!;
  return {
    main,
    title: screen.getByText(ticket.title),
    key: screen.getByText('MOB-18'),
    due: screen.getByText('Oct 9').closest('span')!,
    priority: part('svg[data-priority]'),
    glyph: part('svg[data-category]'),
    avatar: screen.getByRole('img', { name: 'Claude' }),
  };
}

const areaRows = (template = ''): string[][] =>
  [...template.matchAll(/['"]([^'"]*)['"]/g)].map((match) => match[1]!.trim().split(/\s+/));

const areaOf = (element: Element) => phoneStyle(element, MODULE).get('grid-area');

function padding(style: Map<string, string>, side: 'left' | 'right'): number {
  const longhand = style.get(`padding-${side}`);
  if (longhand) return pixels(longhand);
  const [top, right = top, , left = right] = (style.get('padding') ?? '0').split(/\s+/);
  return pixels(side === 'left' ? left : right);
}

// At 375px the bars, a 64px key column, the status glyph, the avatar and four gaps shared the
// title's line, leaving it 117px of the 341px row, so titles wrapped to 3-5 lines.
describe('regression: phone ticket rows give the title most of the width', () => {
  it('gives the title the first line beside the avatar, at least 240px wide at 375px', () => {
    const row = renderRow();
    const main = phoneStyle(row.main, MODULE);
    const [first = []] = areaRows(main.get('grid-template-areas'));
    expect(new Set(first)).toEqual(new Set([areaOf(row.title), areaOf(row.avatar)]));

    const avatar = phoneStyle(row.avatar, 'components/Avatar/Avatar.module.css');
    const gap = main.get('column-gap') ?? main.get('gap')?.split(/\s+/).at(-1);
    const sides = padding(main, 'left') + padding(main, 'right');
    const titleWidth = ROW_WIDTH - sides - pixels(avatar.get('width')) - pixels(gap);
    expect(titleWidth).toBeGreaterThanOrEqual(240);
  });

  it('shows the key, priority and due date on a second line', () => {
    const row = renderRow();
    const [, second = []] = areaRows(phoneStyle(row.main, MODULE).get('grid-template-areas'));
    for (const meta of [row.priority, row.key, row.due]) {
      expect(second).toContain(areaOf(meta));
      expect(phoneStyle(meta, MODULE).get('display')).not.toBe('none');
    }
  });

  it('hides the status glyph, which the group header already shows', () => {
    const row = renderRow();
    expect(phoneStyle(row.glyph, MODULE).get('display')).toBe('none');
  });
});
