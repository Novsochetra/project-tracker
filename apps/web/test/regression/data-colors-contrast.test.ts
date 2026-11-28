import { PROJECT_COLORS, STATUS_COLORS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { markColor } from '../../src/appearance';
import { DARK_MARK_BACKGROUND, DARK_SURFACE } from '../../src/appearance/darkColors';
import { color, contrast, luminance, rgb, tokenValue } from './contrast';

// WCAG 1.4.11: status glyphs and label dots carry meaning, so they keep 3:1 where they are drawn.
const AA_MARK = 3;

// Everywhere a glyph or a dot sits in the dark appearance: the page, rows and cards, their
// headers and hovers, a selected status tab, a grouped area's cards and pressed rows.
const DARK_BACKGROUNDS = [
  '--page',
  '--surface',
  '--row-hover',
  '--fill',
  '--fill-2',
  '--thumb',
  '--panel',
  '--report-bg',
  '--grouped-bg',
  '--grouped-surface',
  '--grouped-row-hover',
  '--grouped-fill',
  '--grouped-fill-2',
];

// Colors an agent or the API may set, besides the palettes the app offers.
const ODD_COLORS = ['#000000', '#3A0A0A', '#0B1F4A', '#FFFFFF', '#FFD700'];

describe('regression: status and label colors read in the dark appearance', () => {
  it('computes against the dark tokens it names', () => {
    expect(DARK_SURFACE).toBe(tokenValue('--surface', 'dark'));
    expect(DARK_MARK_BACKGROUND).toBe(tokenValue('--fill-2', 'dark'));
  });

  it('checks marks against the lightest background they sit on', () => {
    const lightest = Math.max(...DARK_BACKGROUNDS.map((token) => luminance(color(token, 'dark'))));
    expect(luminance(rgb(DARK_MARK_BACKGROUND))).toBe(lightest);
  });

  it.each([...STATUS_COLORS, ...PROJECT_COLORS, ...ODD_COLORS])(
    '%s keeps 3:1 on every dark background',
    (data) => {
      const shown = rgb(markColor(data, 'dark').toLowerCase());
      for (const background of DARK_BACKGROUNDS) {
        const ratio = contrast(shown, color(background, 'dark'));
        expect(ratio, `${data} on ${background}`).toBeGreaterThanOrEqual(AA_MARK);
      }
    },
  );

  it('leaves the light appearance as the data says', () => {
    expect(STATUS_COLORS.map((data) => markColor(data, 'light'))).toEqual(STATUS_COLORS);
  });
});
