import { describe, expect, it } from 'vitest';
import type { RowBox } from '../../project/dnd/dropTarget';
import { clampOffset, orderAfterDrop, rowShifts, slotStep } from './reorderMath';

// Three 32px rows, 2px apart, as in the sidebar.
const rows: RowBox[] = [
  { id: 'a', top: 0, height: 32 },
  { id: 'b', top: 34, height: 32 },
  { id: 'c', top: 68, height: 32 },
];
const ids = ['a', 'b', 'c'];

describe('orderAfterDrop', () => {
  it('puts the row before the target row, or last when there is none', () => {
    expect(orderAfterDrop(ids, 'c', { statusId: '', beforeId: 'a' })).toEqual(['c', 'a', 'b']);
    expect(orderAfterDrop(ids, 'a', { statusId: '', beforeId: 'c' })).toEqual(['b', 'a', 'c']);
    expect(orderAfterDrop(ids, 'a', { statusId: '', beforeId: null })).toEqual(['b', 'c', 'a']);
  });

  it('keeps the order when the row goes back to its place or the target is gone', () => {
    expect(orderAfterDrop(ids, 'b', { statusId: '', beforeId: 'c' })).toEqual(ids);
    expect(orderAfterDrop(ids, 'c', { statusId: '', beforeId: 'gone' })).toEqual(ids);
  });
});

describe('slotStep', () => {
  it("is the dragged row's height and the gap between rows", () => {
    expect(slotStep(rows, 1)).toBe(34);
    expect(slotStep(rows.slice(0, 1), 0)).toBe(32);
    expect(slotStep([], 0)).toBe(0);
  });
});

describe('rowShifts', () => {
  it('moves the rows the dragged row passed by one slot toward its old place', () => {
    expect(rowShifts(ids, ['b', 'c', 'a'], 34)).toEqual(
      new Map([
        ['a', 34],
        ['b', -34],
        ['c', -34],
      ]),
    );
    expect(rowShifts(ids, ['c', 'a', 'b'], 34).get('a')).toBe(34);
    expect(rowShifts(ids, ids, 34)).toEqual(
      new Map([
        ['a', 0],
        ['b', 0],
        ['c', 0],
      ]),
    );
  });
});

describe('clampOffset', () => {
  it('keeps the dragged row between the first and the last row', () => {
    expect(clampOffset(rows, 1, -100)).toBe(-34);
    expect(clampOffset(rows, 1, 100)).toBe(34);
    expect(clampOffset(rows, 1, 12)).toBe(12);
    expect(clampOffset(rows, 0, -5)).toBe(0);
    expect(clampOffset([], 0, 5)).toBe(0);
  });
});
