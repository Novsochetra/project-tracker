import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '../../src');

const css = (path: string): string =>
  readFileSync(join(SRC, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const selectors = (sheet: string): string[] =>
  [...sheet.matchAll(/([^{}]+)\{[^{}]*background/g)].flatMap((match) =>
    match[1]!.split(',').map((part) => part.trim()),
  );

// The drag handle is the row's sibling of its main button, drawn over it. A hover fill keyed on
// the button went away while the pointer was on the handle, leaving the handle's tile on a white
// row (PT-149). The fill hangs on the row, which holds both.
const SURFACES = [
  { module: 'features/project/TicketRow.module.css', row: '.row' },
  { module: 'features/project/board/BoardCard.module.css', row: '.card' },
];

describe('regression: hovering a drag handle keeps its row hovered', () => {
  it.each(SURFACES)('$module', ({ module, row }) => {
    const found = selectors(css(module));
    expect(found).not.toContain('.main:hover');
    expect(found).toContain(`${row}:hover .main`);
  });
});
