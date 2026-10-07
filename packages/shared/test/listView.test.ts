import { describe, expect, it } from 'vitest';
import type { Status, StatusCategory } from '../src/domain/status';
import {
  collapseGroup,
  filterCounts,
  GROUP_LIMIT,
  matchesSearch,
  visibleStatuses,
} from '../src/logic/listView';

const status = (id: string, category: StatusCategory, position: number): Status => ({
  id,
  projectId: 'p1',
  name: id,
  category,
  color: '#8E8E99',
  position,
  createdAt: 0,
});

const statuses = [
  status('done', 'done', 4),
  status('todo', 'todo', 0),
  status('review', 'in_review', 2),
  status('doing', 'in_progress', 1),
  status('reviewed', 'reviewed', 3),
  status('wontdo', 'done', 5),
];

const ids = (list: readonly Status[]) => list.map((s) => s.id);

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

describe('visibleStatuses', () => {
  it('shows every status in position order for All', () => {
    expect(ids(visibleStatuses(statuses, 'all'))).toEqual([
      'todo',
      'doing',
      'review',
      'reviewed',
      'done',
      'wontdo',
    ]);
  });

  it('shows the statuses that are not done for Active', () => {
    expect(ids(visibleStatuses(statuses, 'active'))).toEqual([
      'todo',
      'doing',
      'review',
      'reviewed',
    ]);
  });

  it('shows only done statuses for Done', () => {
    expect(ids(visibleStatuses(statuses, 'done'))).toEqual(['done', 'wontdo']);
  });

  it('returns no groups for Done when the project has no done status', () => {
    expect(visibleStatuses([status('todo', 'todo', 0)], 'done')).toEqual([]);
  });
});

describe('matchesSearch', () => {
  const ticket = { key: 'MOB-3', title: 'Crash when rotating the profile screen' };

  it('matches everything for a blank query', () => {
    expect(matchesSearch(ticket, '')).toBe(true);
    expect(matchesSearch(ticket, '   ')).toBe(true);
  });

  it('matches part of the title, ignoring case', () => {
    expect(matchesSearch(ticket, 'ROTATING')).toBe(true);
    expect(matchesSearch(ticket, 'profile scr')).toBe(true);
  });

  it('matches the key, ignoring case', () => {
    expect(matchesSearch(ticket, 'mob-3')).toBe(true);
    expect(matchesSearch(ticket, 'MOB')).toBe(true);
  });

  it('ignores spaces around the query', () => {
    expect(matchesSearch(ticket, '  mob-3  ')).toBe(true);
  });

  it('matches substrings, so mob-3 also finds MOB-31', () => {
    expect(matchesSearch({ key: 'MOB-31', title: 'Other' }, 'mob-3')).toBe(true);
  });

  it('rejects tickets that match neither title nor key', () => {
    expect(matchesSearch(ticket, 'mob-4')).toBe(false);
    expect(matchesSearch(ticket, 'login')).toBe(false);
  });
});

describe('filterCounts', () => {
  it('counts all, active and done tickets by status category', () => {
    const tickets = [
      { statusId: 'todo' },
      { statusId: 'doing' },
      { statusId: 'review' },
      { statusId: 'reviewed' },
      { statusId: 'done' },
      { statusId: 'wontdo' },
      { statusId: 'todo' },
    ];

    expect(filterCounts(tickets, statuses)).toEqual({ all: 7, active: 5, done: 2 });
  });

  it('returns zeros without tickets', () => {
    expect(filterCounts([], statuses)).toEqual({ all: 0, active: 0, done: 0 });
  });
});

describe('collapseGroup', () => {
  const closed = { expanded: false, searching: false };

  it('shows 5 of 7 tickets with a toggle for the other 2', () => {
    expect(GROUP_LIMIT).toBe(5);
    expect(collapseGroup(range(7), closed)).toEqual({
      shown: [1, 2, 3, 4, 5],
      hiddenCount: 2,
      hasToggle: true,
    });
  });

  it('shows all 6 tickets of a group of 6 without a toggle', () => {
    expect(collapseGroup(range(6), closed)).toEqual({
      shown: range(6),
      hiddenCount: 0,
      hasToggle: false,
    });
  });

  it('shows short groups whole without a toggle', () => {
    expect(collapseGroup([], closed)).toEqual({ shown: [], hiddenCount: 0, hasToggle: false });
    expect(collapseGroup(range(3), closed)).toEqual({
      shown: range(3),
      hiddenCount: 0,
      hasToggle: false,
    });
  });

  it('shows every ticket of an expanded long group, keeping the toggle', () => {
    expect(collapseGroup(range(7), { expanded: true, searching: false })).toEqual({
      shown: range(7),
      hiddenCount: 0,
      hasToggle: true,
    });
  });

  it('shows every match without a toggle while searching', () => {
    const expected = { shown: range(9), hiddenCount: 0, hasToggle: false };

    expect(collapseGroup(range(9), { expanded: false, searching: true })).toEqual(expected);
    expect(collapseGroup(range(9), { expanded: true, searching: true })).toEqual(expected);
  });

  it('returns a copy of the items', () => {
    const items = range(3);

    expect(collapseGroup(items, closed).shown).not.toBe(items);
  });
});
