import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS, statuses } from '../../src/api/test/fixtures';
import { DragGhost } from '../../src/features/project/dnd/DragGhost';
import type { RowCallbacks } from '../../src/features/project/rowTypes';
import { TicketRowContent } from '../../src/features/project/TicketRowContent';
import { edges, phoneRule, phoneStyle, pixels } from './phoneCss';

const GHOST = 'features/project/dnd/DragGhost.module.css';
const ROW = 'features/project/TicketRow.module.css';

const ticket = listItem(18, STATUS.todo, 0, {
  title: 'Long list idea number 18 with a reasonably descriptive title',
  priority: 'high',
  due: '2026-10-09',
  assignee: 'Claude',
});

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  confirmDelete: vi.fn(),
};

function renderGhost() {
  const origin = { left: 16, top: 200, width: 343 };
  const drag = { ticket, status: statuses[0]!, origin, target: null };
  render(<DragGhost drag={drag} ghostRef={() => undefined} />);
  const title = screen.getByText(ticket.title);
  const face = title.parentElement!;
  return {
    face,
    title,
    key: screen.getByText('MOB-18'),
    priority: face.querySelector('svg[data-priority]')!,
    glyph: face.querySelector('svg[data-category]')!,
    avatar: screen.getByTitle('Claude'),
  };
}

function renderRowButton() {
  const status = statuses[0]!;
  render(
    <TicketRowContent ticket={ticket} status={status} dragged={false} callbacks={callbacks} />,
  );
  return screen.getByRole('button', { name: /^MOB-18/ });
}

const areaRows = (template = ''): string[][] =>
  [...template.matchAll(/['"]([^'"]*)['"]/g)].map((match) => match[1]!.trim().split(/\s+/));

const lineOf = (lines: string[][], area: string | undefined): number =>
  lines.findIndex((line) => area !== undefined && line.includes(area));

// After PT-26 phone rows show the title beside the avatar with priority, key and due date on a
// second line, but the lifted copy kept the one-line face: grip, bars, key, glyph, title.
describe('regression: the phone drag ghost mirrors the two-line row', () => {
  it('puts the title beside the avatar, then priority, key and due date below', () => {
    const ghost = renderGhost();
    expect(screen.getByText('Oct 9')).toBeInTheDocument();
    const face = phoneStyle(ghost.face, GHOST);
    expect(face.get('display')).toBe('grid');
    const lines = areaRows(face.get('grid-template-areas'));
    const line = (element: Element) => lineOf(lines, phoneStyle(element, GHOST).get('grid-area'));
    expect([line(ghost.title), line(ghost.avatar)]).toEqual([0, 0]);
    expect([line(ghost.priority), line(ghost.key)]).toEqual([1, 1]);
    const due = phoneRule(GHOST, '.row .due');
    expect(lineOf(lines, due.get('grid-area'))).toBe(1);
    expect(due.get('display')).not.toBe('none');
  });

  // The row's title has the button's regular weight; the SPEC's medium one wraps sooner.
  it('hides the status glyph and wraps the title like the row', () => {
    const ghost = renderGhost();
    expect(phoneStyle(ghost.glyph, GHOST).get('display')).toBe('none');
    const title = phoneStyle(ghost.title, GHOST);
    expect(title.get('white-space')).toBe('normal');
    expect(title.get('font-weight')).toBe('400');
    expect(title.get('line-clamp')).toBe(phoneRule(ROW, '.title').get('line-clamp'));
  });

  // The ghost is as wide as the row, with its border inside that width. The row's handle sits
  // over its left padding, where the ghost draws the grip in a column of its own.
  it('gives the title the row’s start, top and width, and the row’s height', () => {
    const face = phoneStyle(renderGhost().face, GHOST);
    const row = phoneStyle(renderRowButton(), ROW);
    const border = pixels(face.get('border'));
    const [top, right, , left] = edges(face.get('padding'));
    const [rowTop, rowRight] = edges(row.get('padding'));
    const grip = pixels(face.get('grid-template-columns')?.split(/\s+/)[0]);
    const columnGap = pixels(face.get('gap')?.split(/\s+/).at(-1));
    expect(border + left + grip + columnGap).toBe(pixels(row.get('padding-left')));
    expect([border + top, border + right]).toEqual([rowTop, rowRight]);
    expect(face.get('min-height')).toBe(row.get('min-height'));
  });

  it('keeps the SPEC ghost on desktop: one line and no due date', () => {
    const ghost = renderGhost();
    expect(phoneStyle(ghost.face, GHOST, 1280).get('display')).toBe('flex');
    expect(phoneRule(GHOST, '.row .due', 1280).get('display')).toBe('none');
  });
});
