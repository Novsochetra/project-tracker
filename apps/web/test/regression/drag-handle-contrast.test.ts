import { describe, expect, it } from 'vitest';
import { color, contrast, rgb, type Rgb } from './contrast';
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
