import { describe, expect, it } from 'vitest';
import {
  EDGE_PAGE_HOLD_MS,
  edgeSide,
  startEdgePaging,
  stepEdgePaging,
  type EdgePaging,
} from './edgePaging';

const WIDTH = 375;
const HOLD = EDGE_PAGE_HOLD_MS;

type Move = [x: number, at: number];

function pagesTurned(paging: EdgePaging, ...moves: Move[]): number[] {
  const pages: number[] = [];
  let state = paging;
  for (const [x, at] of moves) {
    const step = stepEdgePaging(state, x, WIDTH, at);
    state = step.paging;
    if (step.page !== 0) pages.push(step.page);
  }
  return pages;
}

describe('edgeSide', () => {
  it('is the side whose 32px edge zone the finger is in', () => {
    expect(edgeSide(10, WIDTH)).toBe(-1);
    expect(edgeSide(32, WIDTH)).toBe(-1);
    expect(edgeSide(33, WIDTH)).toBe(0);
    expect(edgeSide(200, WIDTH)).toBe(0);
    expect(edgeSide(342, WIDTH)).toBe(0);
    expect(edgeSide(343, WIDTH)).toBe(1);
  });
});

describe('stepEdgePaging', () => {
  const fromMiddle = startEdgePaging(200, WIDTH);

  it('pages toward an edge after the finger rests there for the hold', () => {
    expect(pagesTurned(fromMiddle, [360, 0], [362, 200], [361, HOLD - 1])).toEqual([]);
    expect(pagesTurned(fromMiddle, [360, 0], [361, HOLD])).toEqual([1]);
    expect(pagesTurned(fromMiddle, [5, 100], [8, 100 + HOLD])).toEqual([-1]);
  });

  it('keeps paging once per hold while the finger stays at the edge', () => {
    const moves = [0, 500, 600, 999, 1000, 1500].map((at): Move => [370, at]);
    expect(pagesTurned(fromMiddle, ...moves)).toEqual([1, 1, 1]);
  });

  it('starts the hold over when the finger leaves the edge or switches sides', () => {
    expect(pagesTurned(fromMiddle, [360, 0], [200, 300], [360, 400], [360, 800])).toEqual([]);
    expect(pagesTurned(fromMiddle, [360, 0], [10, 300], [360, 600])).toEqual([]);
  });

  it('stays quiet at the edge the drag started in until the finger leaves it', () => {
    const fromRightEdge = startEdgePaging(360, WIDTH);
    expect(pagesTurned(fromRightEdge, [360, 0], [365, 900], [370, 2000])).toEqual([]);
    expect(pagesTurned(fromRightEdge, [360, 0], [200, 100], [360, 200], [360, 700])).toEqual([1]);
    expect(pagesTurned(fromRightEdge, [360, 0], [10, 100], [10, 600])).toEqual([-1]);
  });
});
