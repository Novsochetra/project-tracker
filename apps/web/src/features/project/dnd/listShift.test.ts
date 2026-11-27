import { describe, expect, it } from 'vitest';
import type { GroupBox } from './dropTarget';
import { groupsAt, listPlacement, NO_PLACEMENT, placedGroups, type ShiftGroup } from './listShift';

const GROUPS: ShiftGroup[] = [
  { statusId: 'todo', rowIds: ['a', 'b', 'c', 'd'] },
  { statusId: 'doing', rowIds: ['e', 'f'] },
  { statusId: 'review', rowIds: [] },
];

const shifts = (placement: { shifts: Map<string, number> }) => Object.fromEntries(placement.shifts);

describe('listPlacement', () => {
  it('shows nothing without a target', () => {
    expect(listPlacement(GROUPS, 'b', null, 44)).toBe(NO_PLACEMENT);
  });

  it('moves nothing while the ticket is over its own place', () => {
    const target = { statusId: 'todo', beforeId: 'c', afterId: 'a' };

    expect(listPlacement(GROUPS, 'b', target, 44)).toEqual({
      shifts: new Map(),
      grow: null,
      away: false,
    });
  });

  it('slides the rows it passes down its group up one slot', () => {
    const target = { statusId: 'todo', beforeId: null, afterId: 'd' };

    expect(shifts(listPlacement(GROUPS, 'b', target, 44))).toEqual({ c: -44, d: -44 });
  });

  it('slides the rows it passes up its group down one slot', () => {
    const target = { statusId: 'todo', beforeId: 'a', afterId: null };

    expect(shifts(listPlacement(GROUPS, 'c', target, 44))).toEqual({ a: 44, b: 44 });
  });

  it('folds its row away and grows the group it enters, sliding the rows after the drop', () => {
    const target = { statusId: 'doing', beforeId: 'f', afterId: 'e' };

    expect(listPlacement(GROUPS, 'b', target, 50)).toEqual({
      shifts: new Map([['f', 50]]),
      grow: 'doing',
      away: true,
    });
  });

  it('opens the slot after the last shown row of a group', () => {
    const target = { statusId: 'doing', beforeId: null, afterId: 'f' };

    expect(listPlacement(GROUPS, 'a', target, 44)).toEqual({
      shifts: new Map(),
      grow: 'doing',
      away: true,
    });
  });

  it("doesn't grow an empty group, whose drop zone is the slot", () => {
    const target = { statusId: 'review', beforeId: null, afterId: null };

    expect(listPlacement(GROUPS, 'e', target, 44)).toEqual({
      shifts: new Map(),
      grow: null,
      away: true,
    });
  });
});

const box = (statusId: string, top: number, rows: Array<[string, number]>): GroupBox => ({
  statusId,
  top,
  bottom: (rows.at(-1)?.[1] ?? top + 40) + 44,
  left: 0,
  right: 600,
  rows: rows.map(([id, rowTop]) => ({ id, top: rowTop, height: 44 })),
});

// To do: header 0–40, a 40, b 84; In progress from 144: header, e 184, f 228.
const BOXES = [
  box('todo', 0, [
    ['a', 40],
    ['b', 84],
  ]),
  box('doing', 144, [
    ['e', 184],
    ['f', 228],
  ]),
];

const tops = (groups: GroupBox[]) =>
  groups.map((group) => [group.top, group.bottom, ...group.rows.map((row) => row.top)]);

describe('placedGroups', () => {
  it('leaves the list as measured while the ticket stays in its group', () => {
    expect(placedGroups(BOXES, 'a', { grow: null, away: false }, 44)).toEqual(BOXES);
  });

  it('moves up what follows a row that folds away, and down what follows a group that grows', () => {
    expect(tops(placedGroups(BOXES, 'a', { grow: 'doing', away: true }, 44))).toEqual([
      [0, 84, 40, 40],
      [100, 272, 140, 184],
    ]);
  });

  it('cancels out below a group that grows above the row that folds', () => {
    expect(tops(placedGroups(BOXES, 'e', { grow: 'todo', away: true }, 44))).toEqual([
      [0, 172, 40, 84],
      [188, 272, 228, 228],
    ]);
  });
});

describe('groupsAt', () => {
  it('moves the groups and rows to where the list is now', () => {
    expect(tops(groupsAt(BOXES, -30))).toEqual([
      [-30, 98, 10, 54],
      [114, 242, 154, 198],
    ]);
  });
});
