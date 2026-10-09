import { describe, expect, it } from 'vitest';
import { peekHeight, type RowSpan } from './rowPeek';

// A 45.5px caption and four 56px rows, as the project ••• sheet.
const ROWS: RowSpan[] = [45.5, 101.5, 157.5, 213.5].map((top) => ({ top, height: 56 }));
const shown = (height: number, row: RowSpan) => (height - row.top) / row.height;

describe('peekHeight', () => {
  it('leaves rows that fit alone', () => {
    expect(peekHeight(269.5, ROWS)).toBeNull();
    expect(peekHeight(400, ROWS)).toBeNull();
    expect(peekHeight(100, [])).toBeNull();
  });

  it('leaves a card that ends about halfway through a row alone', () => {
    expect(peekHeight(241.5, ROWS)).toBeNull();
    expect(peekHeight(213.5 + 26, ROWS)).toBeNull();
  });

  it('ends a card that ends on a row line or a few px from one halfway through the row above', () => {
    for (const available of [213.5, 216, 225]) {
      const height = peekHeight(available, ROWS);
      expect(height).not.toBeNull();
      expect(shown(height ?? 0, ROWS[2]!)).toBeCloseTo(0.55);
    }
  });

  it('ends a card that shows most of a row partway through it', () => {
    const height = peekHeight(260, ROWS);
    expect(height).not.toBeNull();
    expect(shown(height ?? 0, ROWS[3]!)).toBeCloseTo(0.55);
  });

  it('leaves a card too short to show half of its first row alone', () => {
    expect(peekHeight(60, ROWS)).toBeNull();
  });
});
