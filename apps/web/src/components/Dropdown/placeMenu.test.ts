import { describe, expect, it } from 'vitest';
import { placeMenu } from './placeMenu';

const desktop = { width: 1280, height: 800 };

describe('placeMenu', () => {
  it('sits 4px below the trigger with its right edge 6px inside', () => {
    const place = placeMenu({
      triggerRect: { top: 100, bottom: 144, right: 600 },
      viewport: desktop,
      itemCount: 3,
      isPhone: false,
    });
    expect(place).toEqual({
      top: 148,
      left: 374,
      width: 220,
      maxHeight: 118,
      up: false,
      originX: 220,
    });
  });

  it('estimates the height from the item count', () => {
    const place = placeMenu({
      triggerRect: { top: 100, bottom: 144, right: 600 },
      viewport: desktop,
      itemCount: 7,
      isPhone: false,
    });
    expect(place.maxHeight).toBe(7 * 36 + 10);
  });

  it('uses phone sizes', () => {
    const place = placeMenu({
      triggerRect: { top: 100, bottom: 150, right: 360 },
      viewport: { width: 375, height: 812 },
      itemCount: 3,
      isPhone: true,
    });
    expect(place.width).toBe(240);
    expect(place.maxHeight).toBe(3 * 44 + 10);
    expect(place.left).toBe(114);
  });

  it('stays below when it ends exactly 8px from the bottom', () => {
    const place = placeMenu({
      triggerRect: { top: 626, bottom: 670, right: 600 },
      viewport: desktop,
      itemCount: 3,
      isPhone: false,
    });
    expect(place.up).toBe(false);
    expect(place.top + place.maxHeight).toBe(800 - 8);
  });

  it('opens upward when it would run past the bottom and fits above', () => {
    const place = placeMenu({
      triggerRect: { top: 700, bottom: 744, right: 600 },
      viewport: desktop,
      itemCount: 3,
      isPhone: false,
    });
    expect(place.up).toBe(true);
    expect(place.top).toBe(700 - 4 - 118);
  });

  it('stays below when it fits neither way and there is more room below', () => {
    const place = placeMenu({
      triggerRect: { top: 60, bottom: 104, right: 600 },
      viewport: { width: 1280, height: 400 },
      itemCount: 12,
      isPhone: false,
    });
    expect(place.up).toBe(false);
    expect(place.top).toBe(108);
    expect(place.maxHeight).toBe(400 - 8 - 108);
  });

  it('takes the roomier side and scrolls when it fits neither way', () => {
    const place = placeMenu({
      triggerRect: { top: 500, bottom: 544, right: 600 },
      viewport: desktop,
      itemCount: 30,
      isPhone: false,
    });
    expect(place.up).toBe(true);
    expect(place.maxHeight).toBe(500 - 4 - 8);
    expect(place.top).toBe(8);
  });

  it('clamps to 8px from the left edge', () => {
    const place = placeMenu({
      triggerRect: { top: 100, bottom: 144, right: 100 },
      viewport: desktop,
      itemCount: 3,
      isPhone: false,
    });
    expect(place.left).toBe(8);
    expect(place.originX).toBe(100 - 6 - 8);
  });

  it('clamps to 8px from the right edge', () => {
    const place = placeMenu({
      triggerRect: { top: 100, bottom: 144, right: 1400 },
      viewport: desktop,
      itemCount: 3,
      isPhone: false,
    });
    expect(place.left).toBe(1280 - 220 - 8);
    expect(place.originX).toBe(220);
  });

  it('pins to the left edge when the viewport is narrower than the menu', () => {
    const place = placeMenu({
      triggerRect: { top: 100, bottom: 144, right: 200 },
      viewport: { width: 200, height: 800 },
      itemCount: 3,
      isPhone: false,
    });
    expect(place.left).toBe(8);
  });
});
