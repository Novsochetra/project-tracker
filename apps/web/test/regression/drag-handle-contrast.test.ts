import { describe, expect, it } from 'vitest';
import { color, contrast, rgb } from './contrast';
import { phoneRule } from './phoneCss';

// WCAG 1.4.11: a control needs 3:1 against what is next to it. Phones show every handle all the time.
const AA_CONTROL = 3;

// Handle → the backgrounds of its row: pressed on phones, hovered on desktop, and the flash of a
// row or card that just moved (handles of desktop rows and board cards paint above it).
const HANDLES = [
  {
    module: 'features/project/TicketRow.module.css',
    usage: 'list rows and board cards',
    rows: ['--surface', '--fill', '--row-hover', '--flash'],
  },
  {
    module: 'features/statuses/StatusManagerSheet.module.css',
    usage: 'the statuses list',
    rows: ['--surface', '--fill'],
  },
];

const pairs = HANDLES.flatMap(({ module, usage, rows }) =>
  rows.map((row) => ({ module, usage, row })),
);

describe('regression: drag handles reach 3:1 against their rows', () => {
  it.each(pairs)('$usage on $row', ({ module, row }) => {
    const handle = phoneRule(module, '.handle').get('color') ?? '';
    const ratio = contrast(rgb(handle), color(row));
    expect(ratio, `${handle} on ${row} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_CONTROL,
    );
  });
});
