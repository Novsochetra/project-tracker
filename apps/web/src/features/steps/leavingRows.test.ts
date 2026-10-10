import { describe, expect, it } from 'vitest';
import { leavingRows } from './leavingRows';
import { stepRows } from './stepRows';
import { makeSteps } from './testSteps';

const rows = (count: number, from = 1) => stepRows(makeSteps(count, from));
const seqs = (list: { seq: number }[]) => list.map(({ seq }) => seq);

describe('leavingRows', () => {
  it('is the rows that new steps pushed out of the newest few', () => {
    expect(seqs(leavingRows(rows(5, 1), rows(5, 3)))).toEqual([1, 2]);
  });

  it('is none while the list only grows, or when earlier steps are hidden again', () => {
    expect(leavingRows(rows(3), rows(4))).toEqual([]);
    expect(leavingRows(rows(12), rows(5, 8))).toEqual([]);
    expect(leavingRows([], rows(2))).toEqual([]);
  });
});
