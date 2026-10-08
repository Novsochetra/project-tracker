import { describe, expect, it } from 'vitest';
import { CLICK_SHIELD_MS, isShielded } from './clickShield';

describe('isShielded', () => {
  it('holds back a pointer press until CLICK_SHIELD_MS after the element appeared', () => {
    expect(isShielded(1, 1000, 1000)).toBe(true);
    expect(isShielded(1, 1000, 1000 + CLICK_SHIELD_MS - 1)).toBe(true);
    expect(isShielded(1, 1000, 1000 + CLICK_SHIELD_MS)).toBe(false);
  });

  it('holds back the second press of a double-click too', () => {
    expect(isShielded(2, 1000, 1200)).toBe(true);
  });

  it('lets a keyboard press (detail 0) through at once', () => {
    expect(isShielded(0, 1000, 1000)).toBe(false);
  });

  it('holds back a pointer press before the element has been seen', () => {
    expect(isShielded(1, null, 1000)).toBe(true);
  });
});
