import { render, screen } from '@testing-library/react';
import type { Label } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS, statuses } from '../../src/api/test/fixtures';
import { ProjectLabelsContext } from '../../src/features/labels/projectLabels';
import type { RowCallbacks } from '../../src/features/project/rowTypes';
import { TicketRowContent } from '../../src/features/project/TicketRowContent';
import { phoneRule, pixels } from './phoneCss';

// PT-190: labels on phone rows had to leave rows at 320 and 375px their height. They show in the
// due date's cell, after the date, and give way before the date ever has to wrap. PT-261 turned
// the dots into small named chips, so a release's label reads in the list, under the same rule.

const ROW = 'features/project/TicketRow.module.css';

const label = (id: string, name: string, color: string, position: number): Label => ({
  id,
  projectId: 'p1',
  name,
  color,
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});

const LABELS = [label('l-bug', 'Bug', '#B42318', 0), label('l-ui', 'UI', '#6E56CF', 1)];

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  chooseLabels: vi.fn(),
  confirmDelete: vi.fn(),
};

function renderRow(due: string) {
  const ticket = listItem(18, STATUS.todo, 0, {
    title: 'Long list idea number 18 with a reasonably descriptive title',
    due,
    assignee: 'Claude',
    labelIds: ['l-ui', 'l-bug'],
  });
  render(
    <ProjectLabelsContext value={LABELS}>
      <TicketRowContent
        ticket={ticket}
        status={statuses[0]!}
        dragged={false}
        callbacks={callbacks}
      />
    </ProjectLabelsContext>,
  );
  return screen.getByRole('button', { name: /^MOB-18/ });
}

describe('labels on a phone row', () => {
  it('sit in the due date’s cell, after the date, with their names', () => {
    const main = renderRow('2026-10-09');
    const chips = screen.getAllByText('Bug').at(-1)!.parentElement!.parentElement!;
    const due = chips.parentElement!;
    expect(due.textContent).toBe('Oct 9BugUI');
    expect(due.firstElementChild?.tagName).toBe('svg');
    expect(chips.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    expect(main).toContainElement(due);
    expect(main).toHaveAccessibleName(/Bug/);
  });

  it('take the cell without a due date, which stays hidden on wide rows', () => {
    const main = renderRow('');
    expect(main.querySelector('[data-no-date]')).not.toBeNull();
    expect(phoneRule(ROW, '.main .due[data-no-date]', 1280).get('display')).toBe('none');
    for (const width of [375, 320]) {
      expect(phoneRule(ROW, '.main .due[data-no-date]', width).get('display')).toBe('inline-flex');
    }
  });

  it.each([375, 320])('give way before the date and never add a line at %dpx', (width) => {
    const chips = phoneRule(ROW, '.main .dueLabels', width);
    const [grow, shrink, basis] = (chips.get('flex') ?? '').split(' ');
    expect([grow, basis]).toEqual(['0', 'auto']);
    expect(Number(shrink)).toBeGreaterThanOrEqual(1000);
    expect(chips.get('min-width')).toBe('0');
    expect(chips.get('flex-wrap')).toBe('wrap');
    expect(chips.get('overflow')).toBe('hidden');
    // One chip's height, so chips that wrap out of the line are out of sight.
    expect(pixels(chips.get('height'))).toBe(18);
    expect(phoneRule(ROW, '.main .labels', width).get('display')).toBe('none');
    // Chips that take all but a hair of the room would wrap "May 20, 2027" otherwise.
    expect(phoneRule(ROW, '.main .due', width).get('white-space')).toBe('nowrap');
  });

  it('show the full chips after the title on wide rows', () => {
    expect(phoneRule(ROW, '.main .dueLabels', 1280).get('display')).toBe('none');
    expect(phoneRule(ROW, '.main .labels', 1280).get('max-width')).toBe('40%');
  });
});
