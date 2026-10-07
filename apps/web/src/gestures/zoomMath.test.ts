import { describe, expect, it } from 'vitest';
import {
  clampPan,
  doubleTapZoom,
  DOUBLE_TAP_SCALE,
  fitSize,
  IDENTITY,
  isZoomed,
  MAX_SCALE,
  panLimits,
  pinchState,
  rubberPan,
  rubberScale,
  settleZoom,
  zoomAround,
} from './zoomMath';

const viewport = { width: 400, height: 800 };
const base = fitSize({ width: 2000, height: 1000 }, viewport);

describe('fitSize', () => {
  it('fits the image inside the viewport keeping its ratio', () => {
    expect(base).toEqual({ width: 400, height: 200 });
    expect(fitSize({ width: 100, height: 400 }, viewport)).toEqual({ width: 200, height: 800 });
    expect(fitSize({ width: 0, height: 10 }, viewport)).toEqual({ width: 0, height: 0 });
  });
});

describe('pan bounds', () => {
  it('only allows panning where the zoomed image overflows', () => {
    expect(panLimits(base, viewport, 1)).toEqual({ x: 0, y: 0 });
    expect(panLimits(base, viewport, 2)).toEqual({ x: 200, y: 0 });
    expect(panLimits(base, viewport, 4)).toEqual({ x: 600, y: 0 });
  });

  it('clamps the pan to the bounds', () => {
    expect(clampPan({ scale: 2, x: 500, y: 90 }, base, viewport)).toEqual({
      scale: 2,
      x: 200,
      y: 0,
    });
  });

  it('rubber-bands past the bounds', () => {
    const state = rubberPan({ scale: 2, x: 300, y: 0 }, base, viewport);
    expect(state.x).toBeGreaterThan(200);
    expect(state.x).toBeLessThan(300);
  });
});

describe('focal zoom', () => {
  it('keeps the anchor point still', () => {
    const anchor = { x: 100, y: -50 };
    const next = zoomAround({ scale: 1, x: 0, y: 0 }, anchor, 2);
    expect(next).toEqual({ scale: 2, x: -100, y: 50 });
    const imagePoint = { x: (anchor.x - next.x) / next.scale, y: (anchor.y - next.y) / next.scale };
    expect(imagePoint).toEqual(anchor);
  });

  it('moves the pinched point with the fingers', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const state = pinchState(start, { x: 50, y: 0 }, { x: 80, y: 20 }, 2);
    expect(state).toEqual({ scale: 2, x: -20, y: 20 });
    expect((80 - state.x) / state.scale).toBe(50);
  });

  it('resists zooming past the limits', () => {
    expect(rubberScale(2)).toBe(2);
    expect(rubberScale(0.5)).toBeGreaterThan(0.5);
    expect(rubberScale(0.5)).toBeLessThan(1);
    expect(rubberScale(6)).toBeGreaterThan(MAX_SCALE);
    expect(rubberScale(6)).toBeLessThan(6);
  });
});

describe('settleZoom', () => {
  it('springs back to fit below 1x', () => {
    expect(settleZoom({ scale: 0.7, x: 30, y: 10 }, { x: 0, y: 0 }, base, viewport)).toEqual(
      IDENTITY,
    );
  });

  it('pulls an over-zoom back to the maximum around the fingers', () => {
    const state = settleZoom({ scale: 5, x: 0, y: 0 }, { x: 0, y: 0 }, base, viewport);
    expect(state.scale).toBe(MAX_SCALE);
  });

  it('brings a pan back inside the bounds', () => {
    expect(settleZoom({ scale: 2, x: 400, y: 0 }, { x: 0, y: 0 }, base, viewport)).toEqual({
      scale: 2,
      x: 200,
      y: 0,
    });
  });
});

describe('doubleTapZoom', () => {
  it('zooms in at the tap point', () => {
    const state = doubleTapZoom(IDENTITY, { x: 40, y: 0 }, base, viewport);
    expect(state.scale).toBe(DOUBLE_TAP_SCALE);
    expect(state.x).toBeCloseTo(-60);
    expect(isZoomed(state)).toBe(true);
  });

  it('keeps the zoomed image inside the bounds', () => {
    const state = doubleTapZoom(IDENTITY, { x: 200, y: 300 }, base, viewport);
    expect(state.x).toBe(-panLimits(base, viewport, DOUBLE_TAP_SCALE).x);
    expect(state.y).toBeCloseTo(0);
  });

  it('zooms back out when already zoomed', () => {
    expect(doubleTapZoom({ scale: 3, x: 100, y: 0 }, { x: 0, y: 0 }, base, viewport)).toEqual(
      IDENTITY,
    );
    expect(isZoomed(IDENTITY)).toBe(false);
  });
});
