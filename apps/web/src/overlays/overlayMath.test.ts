import { describe, expect, it } from 'vitest';
import {
  DISMISS_RATIO,
  DISMISS_VELOCITY,
  scrimOpacity,
  sheetOffset,
  shouldDismissSheet,
} from './sheetMath';
import {
  dismissProgress,
  isDoubleTap,
  isTap,
  pageTarget,
  PAGE_VELOCITY,
  shouldDismissViewer,
} from './viewerMath';

describe('sheet drag', () => {
  it('follows the finger down and stretches upward with resistance', () => {
    expect(sheetOffset(120)).toBe(120);
    expect(sheetOffset(-100)).toBeLessThan(0);
    expect(sheetOffset(-100)).toBeGreaterThan(-60);
  });

  it('dismisses past a quarter of its height', () => {
    const height = 600;
    expect(shouldDismissSheet({ offset: height * DISMISS_RATIO, height, velocity: 0 })).toBe(true);
    expect(shouldDismissSheet({ offset: height * DISMISS_RATIO - 1, height, velocity: 0 })).toBe(
      false,
    );
  });

  it('dismisses on a downward flick and stays on an upward one', () => {
    expect(shouldDismissSheet({ offset: 20, height: 600, velocity: DISMISS_VELOCITY })).toBe(true);
    expect(shouldDismissSheet({ offset: 300, height: 600, velocity: -500 })).toBe(false);
    expect(shouldDismissSheet({ offset: -10, height: 600, velocity: 2000 })).toBe(false);
  });

  it('fades the scrim with the drag', () => {
    expect(scrimOpacity(0, 600)).toBe(1);
    expect(scrimOpacity(300, 600)).toBe(0.5);
    expect(scrimOpacity(900, 600)).toBe(0);
    expect(scrimOpacity(-20, 600)).toBe(1);
  });
});

describe('image paging', () => {
  const release = { stride: 420, index: 2, count: 5 };

  it('snaps to the nearest page', () => {
    expect(pageTarget({ ...release, offset: -100, velocity: 0 })).toBe(2);
    expect(pageTarget({ ...release, offset: -260, velocity: 0 })).toBe(3);
    expect(pageTarget({ ...release, offset: 260, velocity: 0 })).toBe(1);
  });

  it('follows a flick to the neighbouring page', () => {
    expect(pageTarget({ ...release, offset: -30, velocity: -PAGE_VELOCITY })).toBe(3);
    expect(pageTarget({ ...release, offset: 30, velocity: PAGE_VELOCITY })).toBe(1);
  });

  it('returns when flicked back against the drag', () => {
    expect(pageTarget({ ...release, offset: -300, velocity: 900 })).toBe(2);
  });

  it('stays inside the gallery and never skips a page', () => {
    expect(pageTarget({ stride: 420, index: 0, count: 3, offset: 300, velocity: 2000 })).toBe(0);
    expect(pageTarget({ stride: 420, index: 2, count: 3, offset: -300, velocity: -2000 })).toBe(2);
    expect(pageTarget({ ...release, offset: -1000, velocity: 0 })).toBe(3);
  });
});

describe('viewer dismiss', () => {
  it('dismisses after a long enough drag down or a flick down', () => {
    expect(shouldDismissViewer(150, 0, 800)).toBe(true);
    expect(shouldDismissViewer(60, 0, 800)).toBe(false);
    expect(shouldDismissViewer(30, 1200, 800)).toBe(true);
  });

  it('stays when flicked back up or dragged up', () => {
    expect(shouldDismissViewer(200, -300, 800)).toBe(false);
    expect(shouldDismissViewer(-200, 0, 800)).toBe(false);
  });

  it('fades the backdrop with distance', () => {
    expect(dismissProgress(0, 800)).toBe(0);
    expect(dismissProgress(200, 800)).toBe(0.5);
    expect(dismissProgress(-800, 800)).toBe(1);
  });
});

describe('taps', () => {
  it('tells a tap from a drag', () => {
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 4, y: 3, t: 120 })).toBe(true);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 30, y: 0, t: 120 })).toBe(false);
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 800 })).toBe(false);
  });

  it('pairs two quick nearby taps', () => {
    const first = { x: 100, y: 100, t: 0 };
    expect(isDoubleTap(null, first)).toBe(false);
    expect(isDoubleTap(first, { x: 110, y: 104, t: 220 })).toBe(true);
    expect(isDoubleTap(first, { x: 110, y: 104, t: 500 })).toBe(false);
    expect(isDoubleTap(first, { x: 220, y: 100, t: 200 })).toBe(false);
  });
});
