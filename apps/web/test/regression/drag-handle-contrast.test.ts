import { describe, expect, it } from 'vitest';
import { blendFlash, color, contrast, rgb, tokenValue, type Rgb } from './contrast';
import { phoneRule } from './phoneCss';

// WCAG 1.4.11: a control needs 3:1 against what is next to it. Phones show every handle all the time.
const AA_CONTROL = 3;

// The row flash is drawn with `mix-blend-mode: multiply` over the row, so under a hovered row the
// handle sits on the flash times the hover fill. Reviewer 29 (PT-55) measured 2.84:1 on a hovered
// list row and 2.92:1 on a hovered board card for the first ~100ms after a drop.
const multiply = (top: Rgb, bottom: Rgb): Rgb =>
  top.map((channel, index) => channel * bottom[index]!) as Rgb;

const flashOver = (row: string) => ({
  name: `--flash over ${row}`,
  rgb: multiply(color('--flash'), color(row)),
});
const plain = (row: string) => ({ name: row, rgb: color(row) });

// Handle → the backgrounds of its row: pressed on phones, hovered on desktop, and the flash of a
// row or card that just moved (handles of desktop rows and board cards paint above it), over a
// resting, pressed or hovered row.
const HANDLES = [
  {
    module: 'features/project/TicketRow.module.css',
    usage: 'list rows and board cards',
    rows: [
      ...['--surface', '--fill', '--row-hover', '--flash'].map(plain),
      ...['--surface', '--fill', '--row-hover'].map(flashOver),
    ],
  },
  {
    module: 'features/statuses/StatusManagerSheet.module.css',
    usage: 'the statuses list',
    rows: ['--surface', '--fill'].map(plain),
  },
];

const pairs = HANDLES.flatMap(({ module, usage, rows }) =>
  rows.map((row) => ({ module, usage, row: row.name, background: row.rgb })),
);

describe('regression: drag handles reach 3:1 against their rows', () => {
  it.each(pairs)('$usage on $row', ({ module, row, background }) => {
    const handle = phoneRule(module, '.handle').get('color') ?? '';
    const ratio = contrast(rgb(handle), background);
    expect(ratio, `${handle} on ${row} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_CONTROL,
    );
  });
});

// The dark appearance: rows are raised on the black page, a board card or a sheet's row a step
// more (tokens.css), and the flash lightens them.
const DARK_ROWS = [
  '--surface',
  '--row-hover',
  '--fill',
  '--grouped-surface',
  '--grouped-row-hover',
  '--grouped-fill',
];

describe('regression: drag handles reach 3:1 against their rows in the dark appearance', () => {
  it('draw every handle in the handle token', () => {
    for (const { module } of HANDLES) {
      expect(phoneRule(module, '.handle').get('color')).toBe(tokenValue('--handle'));
    }
  });

  it.each(DARK_ROWS)('on %s, and under the flash of a row that just moved', (row) => {
    const handle = color('--handle', 'dark');
    for (const background of [color(row, 'dark'), blendFlash(color(row, 'dark'), 'dark')]) {
      const ratio = contrast(handle, background);
      expect(ratio, `${ratio.toFixed(2)}:1 on ${row}`).toBeGreaterThanOrEqual(AA_CONTROL);
    }
  });
});
