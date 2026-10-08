import { describe, expect, it } from 'vitest';
import { isFarBelow } from './farBelow';

describe('isFarBelow', () => {
  it('is far while the box starts below the screen and the room past its end', () => {
    expect(isFarBelow({ intersecting: false, top: 1400, rootBottom: 1218 })).toBe(true);
  });

  it('is near once the box is on the screen or just below it', () => {
    expect(isFarBelow({ intersecting: true, top: 900, rootBottom: 1218 })).toBe(false);
  });

  it('is not below when the box went out of sight above the screen', () => {
    expect(isFarBelow({ intersecting: false, top: -400, rootBottom: 1218 })).toBe(false);
  });

  it('is not far before the observer knows where the screen ends', () => {
    expect(isFarBelow({ intersecting: false, top: 1400, rootBottom: null })).toBe(false);
  });
});
