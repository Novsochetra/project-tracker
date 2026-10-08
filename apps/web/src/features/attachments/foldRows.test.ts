import { describe, expect, it } from 'vitest';
import { rowsHeight } from './foldRows';

// 72px thumbnails in rows 24px apart, under the 24px the phone grid leaves for the x buttons.
const tile = (row: number) => ({ top: 24 + row * 96, bottom: 24 + row * 96 + 72 });

describe('rowsHeight', () => {
  it('ends after the second row when the files take more', () => {
    const tiles = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2].map(tile);
    expect(rowsHeight(tiles)).toBe(192);
  });

  it('leaves files that fit in two rows as they are', () => {
    expect(rowsHeight([0, 0, 1, 1].map(tile))).toBeNull();
    expect(rowsHeight([0].map(tile))).toBeNull();
    expect(rowsHeight([])).toBeNull();
  });

  it('counts a row by where its tiles start, whatever their order', () => {
    expect(rowsHeight([2, 0, 1, 0].map(tile))).toBe(192);
  });
});
