import { describe, expect, it } from 'vitest';
import {
  crossedThreshold,
  pullDistance,
  pullProgress,
  PULL_THRESHOLD,
  shouldRefresh,
} from './pullMath';
import {
  ACTION_WIDTH,
  actionEdge,
  actionLabelOffset,
  isFullSwipe,
  restingOffset,
  swipeOffset,
  swipeOutcome,
  type SwipeGeometry,
} from './swipeActionsMath';

const both: SwipeGeometry = { rowWidth: 400, leadingCount: 1, trailingCount: 2 };
const trailingOnly: SwipeGeometry = { rowWidth: 400, leadingCount: 0, trailingCount: 2 };

describe('swipeOffset', () => {
  it('follows the finger inside the row', () => {
    expect(swipeOffset(120, both)).toBe(120);
    expect(swipeOffset(-300, both)).toBe(-300);
  });

  it('does not move toward a side without actions', () => {
    expect(swipeOffset(80, trailingOnly)).toBe(0);
    expect(swipeOffset(-80, trailingOnly)).toBe(-80);
  });

  it('rubber-bands past the row width', () => {
    const offset = swipeOffset(-520, both);
    expect(offset).toBeLessThan(-400);
    expect(offset).toBeGreaterThan(-520);
  });
});

describe('swipeOutcome', () => {
  it('opens past half of the actions width', () => {
    expect(swipeOutcome(-(ACTION_WIDTH + 1), 0, both)).toEqual({ kind: 'open', side: 'trailing' });
    expect(swipeOutcome(-(ACTION_WIDTH - 1), 0, both)).toEqual({ kind: 'close' });
    expect(swipeOutcome(ACTION_WIDTH / 2 + 1, 0, both)).toEqual({ kind: 'open', side: 'leading' });
  });

  it('follows a flick', () => {
    expect(swipeOutcome(-20, -600, both)).toEqual({ kind: 'open', side: 'trailing' });
    expect(swipeOutcome(-140, 600, both)).toEqual({ kind: 'close' });
    expect(swipeOutcome(20, 600, both)).toEqual({ kind: 'open', side: 'leading' });
  });

  it('triggers the first action past 55% of the row', () => {
    expect(isFullSwipe(-221, 400)).toBe(true);
    expect(isFullSwipe(-219, 400)).toBe(false);
    expect(swipeOutcome(-230, 0, both)).toEqual({ kind: 'full', side: 'trailing' });
    expect(swipeOutcome(230, 900, both)).toEqual({ kind: 'full', side: 'leading' });
  });

  it('closes when there is nothing on that side', () => {
    expect(swipeOutcome(0, 0, both)).toEqual({ kind: 'close' });
    expect(swipeOutcome(150, 0, trailingOnly)).toEqual({ kind: 'close' });
  });

  it('rests at the full actions width when open', () => {
    expect(restingOffset({ kind: 'open', side: 'trailing' }, both)).toBe(-2 * ACTION_WIDTH);
    expect(restingOffset({ kind: 'open', side: 'leading' }, both)).toBe(ACTION_WIDTH);
    expect(restingOffset({ kind: 'full', side: 'leading' }, both)).toBe(0);
  });
});

describe('action layout', () => {
  it('shares the revealed space equally', () => {
    const reveal = 2 * ACTION_WIDTH;
    expect(actionEdge(reveal, 0, 2, 0)).toBe(ACTION_WIDTH);
    expect(actionEdge(reveal, 1, 2, 0)).toBe(2 * ACTION_WIDTH);
    expect(actionLabelOffset(reveal, 1, 2, 0)).toBe(0);
  });

  it('lets the first action cover everything on a full swipe', () => {
    expect(actionEdge(300, 0, 2, 1)).toBe(300);
    expect(actionEdge(300, 1, 2, 1)).toBe(300);
    expect(actionLabelOffset(300, 0, 2, 1)).toBe(0);
  });

  it('centres labels in narrow slices', () => {
    expect(actionLabelOffset(40, 0, 1, 0)).toBe((40 - ACTION_WIDTH) / 2);
    expect(actionEdge(-10, 0, 1, 0)).toBe(0);
  });
});

describe('pull to refresh', () => {
  it('resists the pull', () => {
    expect(pullDistance(-10)).toBe(0);
    expect(pullDistance(100)).toBeLessThan(100);
    expect(pullDistance(100)).toBeGreaterThan(40);
  });

  it('reaches the threshold after a deliberate pull', () => {
    expect(shouldRefresh(pullDistance(110))).toBe(false);
    expect(shouldRefresh(pullDistance(160))).toBe(true);
  });

  it('reports progress and threshold crossings', () => {
    expect(pullProgress(35)).toBe(0.5);
    expect(pullProgress(200)).toBe(1);
    expect(crossedThreshold(PULL_THRESHOLD - 1, PULL_THRESHOLD)).toBe(true);
    expect(crossedThreshold(PULL_THRESHOLD + 5, PULL_THRESHOLD - 5)).toBe(true);
    expect(crossedThreshold(10, 20)).toBe(false);
  });
});
