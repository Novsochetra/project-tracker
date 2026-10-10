import { expect, it } from 'vitest';
import { peekHeight, type RowSpan } from '../../src/overlays/rowPeek';

// PT-129: a card of rows that ended just short of halfway through a row, 43% into it, already read
// as going on, but it was cut back to 55% of the row above: about 50px of a 56px row lost on a
// screen about 300px high. The card can't grow to reach the middle of that row, so it stays.

const CAPTION = 45.5;
const ROW = 56;
const ROWS: RowSpan[] = [0, 1, 2, 3].map((index) => ({ top: CAPTION + index * ROW, height: ROW }));
const deleteTop = CAPTION + 3 * ROW;

it('leaves a card that ends a little short of halfway through a row alone', () => {
  for (const shown of [0.32, 0.38, 0.43, 0.449]) {
    expect(peekHeight(deleteTop + shown * ROW, ROWS)).toBeNull();
  }
});
