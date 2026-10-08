import { describe, expect, it } from 'vitest';
import { listItem, STATUS, statuses } from '../../api/test/fixtures';
import {
  buildColumns,
  buildGroups,
  groupRiseDelay,
  nextStatus,
  revealedRowDelay,
  type GroupsInput,
} from './buildGroups';

const tickets = [
  listItem(1, STATUS.todo, 1000, { title: 'Fix login' }),
  listItem(2, STATUS.todo, 0, { title: 'Crash on rotate' }),
  listItem(3, STATUS.review, 0, { title: 'Cache avatars' }),
  listItem(4, STATUS.done, 0, { title: 'Push notifications' }),
];

const input = (patch: Partial<GroupsInput> = {}): GroupsInput => ({
  statuses,
  tickets,
  filter: 'all',
  query: '',
  dragging: false,
  ...patch,
});

const shape = (groups: ReturnType<typeof buildGroups>) =>
  groups.map((group) => [group.status.name, group.tickets.map((ticket) => ticket.key)]);

describe('buildGroups', () => {
  it('lists non-empty groups in status order with tickets by rank', () => {
    expect(shape(buildGroups(input()))).toEqual([
      ['To do', ['MOB-2', 'MOB-1']],
      ['Need review', ['MOB-3']],
      ['Done', ['MOB-4']],
    ]);
  });

  it('follows the status positions, not the list order', () => {
    const reordered = statuses.map((status) =>
      status.id === STATUS.done ? { ...status, position: -1 } : status,
    );
    expect(buildGroups(input({ statuses: reordered }))[0]?.status.name).toBe('Done');
  });

  it('shows only open statuses for Active and only done ones for Done', () => {
    expect(shape(buildGroups(input({ filter: 'active' }))).map(([name]) => name)).toEqual([
      'To do',
      'Need review',
    ]);
    expect(shape(buildGroups(input({ filter: 'done' })))).toEqual([['Done', ['MOB-4']]]);
  });

  it('searches titles and keys', () => {
    expect(shape(buildGroups(input({ query: 'mob-3' })))).toEqual([['Need review', ['MOB-3']]]);
    expect(shape(buildGroups(input({ query: 'CRASH' })))).toEqual([['To do', ['MOB-2']]]);
    expect(buildGroups(input({ query: 'zzz' }))).toEqual([]);
  });

  it('shows every visible group while dragging, even empty ones', () => {
    expect(buildGroups(input({ dragging: true })).map((group) => group.status.name)).toEqual([
      'To do',
      'In progress',
      'Need review',
      'Reviewed',
      'Done',
    ]);
    expect(
      buildGroups(input({ dragging: true, filter: 'active' })).map((group) => group.status.name),
    ).not.toContain('Done');
  });
});

describe('buildColumns', () => {
  it('keeps a column for every status the filter shows, empty or not', () => {
    expect(shape(buildColumns(input()))).toEqual([
      ['To do', ['MOB-2', 'MOB-1']],
      ['In progress', []],
      ['Need review', ['MOB-3']],
      ['Reviewed', []],
      ['Done', ['MOB-4']],
    ]);
    expect(shape(buildColumns(input({ filter: 'done' })))).toEqual([['Done', ['MOB-4']]]);
  });

  it('narrows every column to the search without dropping any', () => {
    expect(shape(buildColumns(input({ filter: 'active', query: 'crash' })))).toEqual([
      ['To do', ['MOB-2']],
      ['In progress', []],
      ['Need review', []],
      ['Reviewed', []],
    ]);
  });
});

describe('nextStatus', () => {
  it('is the following status in order, and none after the last', () => {
    expect(nextStatus(statuses, STATUS.todo)?.name).toBe('In progress');
    expect(nextStatus(statuses, STATUS.reviewed)?.name).toBe('Done');
    expect(nextStatus(statuses, STATUS.done)).toBeNull();
    expect(nextStatus(statuses, 'missing')).toBeNull();
  });
});

describe('rise delays', () => {
  it('staggers groups by 40ms, capped at 12', () => {
    expect(groupRiseDelay(0)).toBe(0);
    expect(groupRiseDelay(2)).toBe(80);
    expect(groupRiseDelay(30)).toBe(480);
  });

  it('staggers only the rows that Show more reveals', () => {
    expect(revealedRowDelay(4, 7)).toBeNull();
    expect(revealedRowDelay(5, 6)).toBeNull();
    expect(revealedRowDelay(5, 7)).toBe(0);
    expect(revealedRowDelay(6, 7)).toBe(18);
  });
});
