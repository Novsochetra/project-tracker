import { describe, expect, it } from 'vitest';
import { shownOffset, stretchOf } from './useSheetStretch';

describe('a phone sheet pulled past its height', () => {
  it('grows from the top instead of lifting off the bottom', () => {
    expect(shownOffset(-30)).toBe(0);
    expect(stretchOf(-30)).toBe('30px');
  });

  it('moves down as it is pulled down, with nothing added at its foot', () => {
    expect(shownOffset(120)).toBe(120);
    expect(stretchOf(120)).toBe('0px');
  });
});
