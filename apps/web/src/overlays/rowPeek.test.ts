import { describe, expect, it } from 'vitest';
import { peekHeight, type RowSpan } from './rowPeek';

// A 45.5px caption and four 56px rows, as the project ••• sheet.
const ROWS: RowSpan[] = [45.5, 101.5, 157.5, 213.5].map((top) => ({ top, height: 56 }));
const shown = (height: number, row: RowSpan) => (height - row.top) / row.height;

describe('peekHeight', () => {
  it('leaves rows that fit alone', () => {
    expect(peekHeight(269.5, ROWS)).toBeNull();
    expect(peekHeight(269.8, ROWS)).toBeNull();
    expect(peekHeight(400, ROWS)).toBeNull();
    expect(peekHeight(100, [])).toBeNull();
  });

  it('leaves a card that ends 30–70% into a row alone', () => {
    for (const share of [0.31, 0.43, 0.5, 0.62, 0.69]) {
      expect(peekHeight(213.5 + share * 56, ROWS)).toBeNull();
    }
  });

  it('ends a card that ends on a row line or near one halfway through the row above', () => {
    for (const available of [213.5, 213.2, 216, 225, 230]) {
      const height = peekHeight(available, ROWS);
      expect(height).not.toBeNull();
      expect(shown(height ?? 0, ROWS[2]!)).toBeCloseTo(0.5);
    }
  });

  it('ends a card that shows most of a row halfway through it', () => {
    for (const available of [253.5, 260, 268]) {
      const height = peekHeight(available, ROWS);
      expect(height).not.toBeNull();
      expect(shown(height ?? 0, ROWS[3]!)).toBeCloseTo(0.5);
    }
  });

  it('leaves a card that ends near the top of its first row alone', () => {
    expect(peekHeight(50, ROWS)).toBeNull();
    expect(peekHeight(30, ROWS)).toBeNull();
  });
});
