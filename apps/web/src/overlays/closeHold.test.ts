import { describe, expect, it } from 'vitest';
import { CLICK_SHIELD_MS } from '../lib/clickShield';
import { closedByClick } from './closeHold';

describe('closedByClick', () => {
  it('holds a close within CLICK_SHIELD_MS of a click on the sheet', () => {
    expect(closedByClick(1000, 1000)).toBe(true);
    expect(closedByClick(1000, 1000 + CLICK_SHIELD_MS - 1)).toBe(true);
  });

  it('lets a later close, or one with no click before it, go without a hold', () => {
    expect(closedByClick(1000, 1000 + CLICK_SHIELD_MS)).toBe(false);
    expect(closedByClick(null, 1000)).toBe(false);
  });
});
