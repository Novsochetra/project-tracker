import { describe, expect, it } from 'vitest';
import {
  dropEdgeFor,
  dropTargetAt,
  groupAt,
  insertionIndex,
  sameTarget,
  type GroupBox,
} from './dropTarget';

// Two 44px rows per group, groups 16px apart: To do 100–189, Done 205–294.
const groups: GroupBox[] = [
  {
    statusId: 'todo',
    top: 100,
    bottom: 189,
    rows: [
      { id: 'a', top: 101, height: 44 },
      { id: 'b', top: 145, height: 44 },
    ],
  },
  {
    statusId: 'done',
    top: 205,
    bottom: 294,
    rows: [
      { id: 'c', top: 206, height: 44 },
      { id: 'd', top: 250, height: 44 },
    ],
  },
];

describe('groupAt', () => {
  it('picks the group under the pointer', () => {
    expect(groupAt(groups, 150)?.statusId).toBe('todo');
    expect(groupAt(groups, 260)?.statusId).toBe('done');
  });

  it('picks the nearest group above, below and between groups', () => {
    expect(groupAt(groups, 20)?.statusId).toBe('todo');
    expect(groupAt(groups, 900)?.statusId).toBe('done');
    expect(groupAt(groups, 193)?.statusId).toBe('todo');
    expect(groupAt(groups, 202)?.statusId).toBe('done');
  });

  it('has no group without groups', () => {
    expect(groupAt([], 100)).toBeNull();
  });
});

describe('insertionIndex', () => {
  it('uses row midpoints', () => {
    const rows = groups[0]!.rows;
    expect(insertionIndex(rows, 110)).toBe(0);
    expect(insertionIndex(rows, 130)).toBe(1);
    expect(insertionIndex(rows, 170)).toBe(2);
  });
});

describe('dropTargetAt', () => {
  it('lands before the row whose midpoint is below the pointer', () => {
    expect(dropTargetAt(groups, 210, 'a')).toEqual({
      statusId: 'done',
      beforeId: 'c',
      afterId: null,
    });
    expect(dropTargetAt(groups, 240, 'a')).toEqual({
      statusId: 'done',
      beforeId: 'd',
      afterId: 'c',
    });
  });

  it('lands after the last row below every midpoint', () => {
    expect(dropTargetAt(groups, 290, 'a')).toEqual({
      statusId: 'done',
      beforeId: null,
      afterId: 'd',
    });
  });

  it('ignores the dragged row', () => {
    expect(dropTargetAt(groups, 150, 'a')).toEqual({
      statusId: 'todo',
      beforeId: 'b',
      afterId: null,
    });
  });

  it('targets an empty group as a whole', () => {
    const empty: GroupBox = { statusId: 'review', top: 310, bottom: 374, rows: [] };
    expect(dropTargetAt([...groups, empty], 340, 'a')).toEqual({
      statusId: 'review',
      beforeId: null,
      afterId: null,
    });
  });

  it('drops into the nearer group from the gap between groups', () => {
    expect(dropTargetAt(groups, 200, 'a')?.statusId).toBe('done');
    expect(dropTargetAt(groups, 192, 'c')?.statusId).toBe('todo');
  });
});

describe('sameTarget', () => {
  it('treats missing and null neighbours alike', () => {
    expect(sameTarget({ statusId: 's', beforeId: null }, { statusId: 's', afterId: null })).toBe(
      true,
    );
    expect(sameTarget({ statusId: 's', beforeId: 'a' }, { statusId: 's', beforeId: 'b' })).toBe(
      false,
    );
    expect(sameTarget(null, null)).toBe(true);
    expect(sameTarget(null, { statusId: 's' })).toBe(false);
  });
});

describe('dropEdgeFor', () => {
  it('draws above the row the ticket lands before', () => {
    expect(dropEdgeFor({ statusId: 's', beforeId: 'b', afterId: 'a' }, 'b')).toBe('before');
    expect(dropEdgeFor({ statusId: 's', beforeId: 'b', afterId: 'a' }, 'a')).toBeNull();
  });

  it('draws below the last row', () => {
    expect(dropEdgeFor({ statusId: 's', beforeId: null, afterId: 'a' }, 'a')).toBe('after');
  });

  it('draws nothing without a target', () => {
    expect(dropEdgeFor(null, 'a')).toBeNull();
  });
});
