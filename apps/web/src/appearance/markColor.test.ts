import { STATUS_COLORS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { contrast, parseHex } from '../lib/contrast';
import { DARK_MARK_BACKGROUND } from './darkColors';
import { markColor } from './markColor';

const onDark = (color: string) => contrast(parseHex(color)!, parseHex(DARK_MARK_BACKGROUND)!);

describe('markColor', () => {
  it('leaves every color as it is in the light appearance', () => {
    expect(markColor('#5B5BD6', 'light')).toBe('#5B5BD6');
  });

  it('keeps a color that already reads on dark, like To do’s gray', () => {
    expect(onDark('#8E8E99')).toBeGreaterThanOrEqual(3);
    expect(markColor('#8E8E99', 'dark')).toBe('#8E8E99');
  });

  it('lightens Done’s indigo just enough, keeping its hue', () => {
    expect(onDark('#5B5BD6')).toBeLessThan(3);
    const shown = markColor('#5B5BD6', 'dark');
    expect(onDark(shown)).toBeGreaterThanOrEqual(3);
    expect(onDark(shown)).toBeLessThan(3.6);
    const [red, green, blue] = parseHex(shown)!;
    expect(red).toBe(green);
    expect(blue).toBeGreaterThan(red);
  });

  it.each([...STATUS_COLORS, '#000000', '#3A0A0A'])('reaches 3:1 on dark for %s', (color) => {
    expect(onDark(markColor(color, 'dark'))).toBeGreaterThanOrEqual(3);
  });

  it('leaves a color it can’t read as it is', () => {
    expect(markColor('teal', 'dark')).toBe('teal');
  });
});
