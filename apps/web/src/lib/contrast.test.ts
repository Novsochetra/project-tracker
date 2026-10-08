import { describe, expect, it } from 'vitest';
import { contrast, mix, parseHex, toHex, WHITE } from './contrast';

const hex = (value: string) => parseHex(value)!;

describe('parseHex and toHex', () => {
  it('reads #rrggbb in either case and writes it back in lower case', () => {
    expect(parseHex('#FF0080')).toEqual([1, 0, 128 / 255]);
    expect(toHex(hex('#12A594'))).toBe('#12a594');
  });

  it('reads nothing else', () => {
    expect(parseHex('teal')).toBeNull();
    expect(parseHex('#fff')).toBeNull();
    expect(parseHex('#12A594 ')).toBeNull();
  });

  it('rounds channels to the nearest step', () => {
    expect(toHex([0.5, 1.2, -0.1])).toBe('#80ff00');
  });
});

describe('contrast', () => {
  it('gives the WCAG ratios, whichever color comes first', () => {
    expect(contrast(hex('#000000'), WHITE)).toBeCloseTo(21, 5);
    expect(contrast(hex('#767676'), WHITE)).toBeCloseTo(4.54, 2);
    expect(contrast(WHITE, hex('#767676'))).toBeCloseTo(4.54, 2);
    expect(contrast(WHITE, WHITE)).toBe(1);
  });
});

describe('mix', () => {
  it('mixes encoded channels like color-mix(in srgb)', () => {
    expect(toHex(mix(hex('#12A594'), WHITE, 0.1))).toBe('#e7f6f4');
    expect(mix(hex('#12A594'), WHITE, 1)).toEqual(hex('#12A594'));
  });
});
