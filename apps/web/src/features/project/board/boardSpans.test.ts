import { describe, expect, it } from 'vitest';
import { currentPage, revealDistance, type Span } from './boardSpans';

// A 375px phone: 317px columns 16px apart after 16px of padding, scrolled by `by`.
const columnsScrolledBy = (by: number): Span[] =>
  [0, 1, 2, 3, 4].map((index) => ({ left: 16 + index * 333 - by, right: 333 + index * 333 - by }));
const view: Span = { left: 0, right: 375 };

describe('currentPage', () => {
  it('is the column whose middle is nearest the middle of the board', () => {
    expect(currentPage(columnsScrolledBy(0), view)).toBe(0);
    expect(currentPage(columnsScrolledBy(333), view)).toBe(1);
    expect(currentPage(columnsScrolledBy(1332), view)).toBe(4);
  });

  it('turns over halfway through a swipe', () => {
    expect(currentPage(columnsScrolledBy(153), view)).toBe(0);
    expect(currentPage(columnsScrolledBy(154), view)).toBe(1);
  });

  it('finds a last column that stopped short of the start', () => {
    expect(currentPage(columnsScrolledBy(1306), view)).toBe(4);
  });

  it('is the first page without columns', () => {
    expect(currentPage([], view)).toBe(0);
  });
});

describe('revealDistance', () => {
  const board: Span = { left: 16, right: 984 };

  it('leaves an item that already shows in full', () => {
    expect(revealDistance({ left: 304, right: 564 }, board)).toBe(0);
  });

  it('scrolls just far enough to bring a cut-off item in from either side', () => {
    expect(revealDistance({ left: 848, right: 1108 }, board)).toBe(124);
    expect(revealDistance({ left: -100, right: 160 }, board)).toBe(-116);
  });

  it('shows the start of an item wider than the board', () => {
    expect(revealDistance({ left: 600, right: 2000 }, board)).toBe(584);
  });
});
