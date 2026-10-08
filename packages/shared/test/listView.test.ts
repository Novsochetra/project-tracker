import { describe, expect, it } from 'vitest';
import type { Status, StatusCategory } from '../src/domain/status';
import {
  ALL_TICKETS,
  collapseGroup,
  filterTabs,
  GROUP_LIMIT,
  matchesSearch,
  resolveFilter,
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
    expect(ids(visibleStatuses(statuses, ALL_TICKETS))).toEqual([
      'todo',
      'doing',
      'review',
      'reviewed',
      'done',
      'wontdo',
    ]);
  });

  it("shows only the picked status for a status's tab", () => {
    expect(ids(visibleStatuses(statuses, 'review'))).toEqual(['review']);
    expect(ids(visibleStatuses(statuses, 'wontdo'))).toEqual(['wontdo']);
  });

  it('shows every status again when the picked one was deleted', () => {
    const left = statuses.filter((s) => s.id !== 'review');
    expect(ids(visibleStatuses(left, 'review'))).toEqual(ids(visibleStatuses(left, ALL_TICKETS)));
  });
});

describe('resolveFilter', () => {
  it('keeps All and a status that exists', () => {
    expect(resolveFilter(statuses, ALL_TICKETS)).toBe(ALL_TICKETS);
    expect(resolveFilter(statuses, 'doing')).toBe('doing');
  });

  it('falls back to All for a status that was deleted', () => {
    expect(resolveFilter(statuses, 'gone')).toBe(ALL_TICKETS);
    expect(resolveFilter([], 'todo')).toBe(ALL_TICKETS);
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

describe('filterTabs', () => {
  const tabsOf = (list: readonly Status[], tickets: readonly { statusId: string }[]) =>
    filterTabs(list, tickets).map((tab) => [tab.value, tab.status?.name ?? null, tab.count]);

  it('puts All first, then one tab per status in position order, each with its count', () => {
    const tickets = [
      { statusId: 'todo' },
      { statusId: 'doing' },
      { statusId: 'review' },
      { statusId: 'reviewed' },
      { statusId: 'done' },
      { statusId: 'wontdo' },
      { statusId: 'todo' },
    ];

    expect(tabsOf(statuses, tickets)).toEqual([
      [ALL_TICKETS, null, 7],
      ['todo', 'todo', 2],
      ['doing', 'doing', 1],
      ['review', 'review', 1],
      ['reviewed', 'reviewed', 1],
      ['done', 'done', 1],
      ['wontdo', 'wontdo', 1],
    ]);
  });

  it('keeps empty statuses with a count of 0', () => {
    expect(tabsOf(statuses, [])).toEqual([
      [ALL_TICKETS, null, 0],
      ['todo', 'todo', 0],
      ['doing', 'doing', 0],
      ['review', 'review', 0],
      ['reviewed', 'reviewed', 0],
      ['done', 'done', 0],
      ['wontdo', 'wontdo', 0],
    ]);
  });

  it('works for any number of statuses, custom ones included', () => {
    const one = [{ ...status('only', 'todo', 0), name: 'Inbox' }];
    expect(tabsOf(one, [{ statusId: 'only' }])).toEqual([
      [ALL_TICKETS, null, 1],
      ['only', 'Inbox', 1],
    ]);

    const eight = Array.from({ length: 8 }, (_, index) => ({
      ...status(`s${index}`, index === 7 ? 'done' : 'in_progress', 7 - index),
      name: `Stage ${index}`,
    }));
    const tabs = filterTabs(eight, [{ statusId: 's3' }, { statusId: 's3' }]);
    expect(tabs).toHaveLength(9);
    expect(tabs.map((tab) => tab.status?.name ?? 'All')).toEqual([
      'All',
      'Stage 7',
      'Stage 6',
      'Stage 5',
      'Stage 4',
      'Stage 3',
      'Stage 2',
      'Stage 1',
      'Stage 0',
    ]);
    expect(tabs.find((tab) => tab.value === 's3')?.count).toBe(2);
  });

  it('gives each status tab the status itself, for its glyph and color', () => {
    const custom = { ...status('qa', 'in_review', 0), name: 'QA', color: '#12A594' };
    expect(filterTabs([custom], [])[1]?.status).toBe(custom);
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
