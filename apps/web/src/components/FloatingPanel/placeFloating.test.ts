import { describe, expect, it } from 'vitest';
import { placeFloating } from './placeFloating';

const size = { width: 392, height: 290 };
const viewport = { width: 1280, height: 800 };
const row = (top: number, right = 1260) => ({ top, right, bottom: top + 44 });

describe('placeFloating', () => {
  it('opens 4px below the row, its right edge 6px inside the row', () => {
    expect(placeFloating({ anchor: row(300), size, viewport })).toEqual({
      top: 348,
      left: 862,
      height: 290,
      up: false,
      originX: 392,
    });
  });

  it('flips above the row when there is no room below', () => {
    const place = placeFloating({ anchor: row(600), size, viewport });
    expect(place.up).toBe(true);
    expect(place.top).toBe(600 - 4 - 290);
  });

  it('stays below when it fits there, however close to the bottom', () => {
    const anchor = row(800 - 8 - 290 - 4 - 44);
    expect(placeFloating({ anchor, size, viewport }).up).toBe(false);
  });

  it('takes the roomier side and stays on screen when neither side fits', () => {
    const short = { width: 1280, height: 400 };
    const below = placeFloating({ anchor: row(150), size, viewport: short });
    expect(below.up).toBe(false);
    expect(below.top).toBe(400 - 8 - 290);
    expect(below.height).toBe(290);
    const above = placeFloating({ anchor: row(220), size, viewport: short });
    expect(above.up).toBe(true);
    expect(above.top).toBe(8);
  });

  it('shrinks to the room on the roomier side when it may scroll', () => {
    const short = { width: 1280, height: 400 };
    const below = placeFloating({ anchor: row(150), size, viewport: short, minHeight: 46 });
    expect(below).toMatchObject({ up: false, top: 198, height: 400 - 8 - 198 });
    const above = placeFloating({ anchor: row(220), size, viewport: short, minHeight: 46 });
    expect(above).toMatchObject({ up: true, top: 8, height: 220 - 4 - 8 });
  });

  it('keeps its smallest height on screen when even that does not fit', () => {
    const tiny = { width: 1280, height: 120 };
    const place = placeFloating({ anchor: row(30), size, viewport: tiny, minHeight: 46 });
    expect(place.height).toBe(46);
    expect(place.top).toBe(120 - 8 - 46);
  });

  it('keeps 8px from the left and right edges of the screen', () => {
    expect(placeFloating({ anchor: row(300, 200), size, viewport }).left).toBe(8);
    expect(placeFloating({ anchor: row(300, 1280), size, viewport }).left).toBe(1280 - 8 - 392);
  });

  it('grows from the corner nearest the row', () => {
    expect(placeFloating({ anchor: row(300, 200), size, viewport }).originX).toBe(200 - 6 - 8);
    expect(placeFloating({ anchor: row(300, 1280), size, viewport }).originX).toBe(392);
  });
});
