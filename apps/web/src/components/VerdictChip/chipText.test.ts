import { STATUS_COLORS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { contrast, mix, parseHex, WHITE } from '../../lib/contrast';
import { DARK_SURFACE } from '../../appearance/darkColors';
import { chipTextColor } from './chipText';

const AA_TEXT = 4.5;
const tintOf = (color: string) => mix(parseHex(color)!, WHITE, 0.1);
const onTint = (text: string, color: string) => contrast(parseHex(text)!, tintOf(color));

describe('chipTextColor', () => {
  it('keeps a color that already reads on its tint, like the default Reviewed green', () => {
    expect(onTint('#18794E', '#18794E')).toBeGreaterThanOrEqual(AA_TEXT);
    expect(chipTextColor('#18794E')).toBe('#18794E');
  });

  // PT-39: an "approved" chip in a custom teal status color drew its label at 2.77:1.
  it('darkens a color that does not read until it reaches 4.5:1, keeping its hue', () => {
    expect(onTint('#12A594', '#12A594')).toBeCloseTo(2.77, 2);
    const text = chipTextColor('#12A594');
    expect(onTint(text, '#12A594')).toBeGreaterThanOrEqual(AA_TEXT);
    const [red, green, blue] = parseHex(text)!;
    expect(green).toBeGreaterThan(blue);
    expect(blue).toBeGreaterThan(red);
  });

  it('darkens no further than it needs to', () => {
    expect(onTint(chipTextColor('#12A594'), '#12A594')).toBeLessThan(5);
  });

  it.each([...STATUS_COLORS, '#FFD700', '#FFFFFF', '#7FDBFF', '#000000'])(
    'reads at 4.5:1 or more on the tint of %s',
    (color) => {
      expect(onTint(chipTextColor(color), color)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('leaves a color it can’t read as it is', () => {
    expect(chipTextColor('teal')).toBe('teal');
  });
});

describe('chipTextColor in the dark appearance', () => {
  const darkTint = (color: string) => mix(parseHex(color)!, parseHex(DARK_SURFACE)!, 0.1);
  const onDarkTint = (text: string, color: string) => contrast(parseHex(text)!, darkTint(color));

  it('keeps a color that already reads on its dark tint', () => {
    expect(onDarkTint('#12A594', '#12A594')).toBeGreaterThanOrEqual(AA_TEXT);
    expect(chipTextColor('#12A594', 'dark')).toBe('#12A594');
  });

  // The default Reviewed green reads on white, but is too dark on its tint over the dark surface.
  it('lightens a dark color toward white until it reaches 4.5:1, keeping its hue', () => {
    expect(onDarkTint('#18794E', '#18794E')).toBeLessThan(AA_TEXT);
    const text = chipTextColor('#18794E', 'dark');
    expect(onDarkTint(text, '#18794E')).toBeGreaterThanOrEqual(AA_TEXT);
    const [red, green, blue] = parseHex(text)!;
    expect(green).toBeGreaterThan(blue);
    expect(blue).toBeGreaterThan(red);
  });

  it.each([...STATUS_COLORS, '#FFD700', '#FFFFFF', '#7FDBFF', '#000000'])(
    'reads at 4.5:1 or more on the dark tint of %s',
    (color) => {
      expect(onDarkTint(chipTextColor(color, 'dark'), color)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );
});
