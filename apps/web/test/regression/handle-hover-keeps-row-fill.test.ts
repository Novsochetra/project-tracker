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

// The drag handle is a sibling of the row's main button. A hover fill keyed on the button went
// away while the pointer was on the handle, leaving the handle's tile on a white row (PT-149). The
// fill hangs on the row, which holds both. The pointer stays on the handle through a drag, so the
// dragged row is left out: it keeps its resting background, like the design's lifted row.
const SURFACES = [
  {
    module: 'features/project/TicketRow.module.css',
    onButton: '.main:hover',
    onRow: '.row:hover .main:not([data-dragged])',
  },
  {
    module: 'features/project/board/BoardCard.module.css',
    onButton: '.main:hover',
    onRow: '.card:hover .main:not([data-dragged])',
  },
  {
    module: 'features/statuses/StatusManagerSheet.module.css',
    onButton: '.item:has(.row:hover)',
    onRow: '.item:hover:not([data-dragging])',
  },
];

describe('regression: hovering a drag handle keeps its row hovered', () => {
  it.each(SURFACES)('$module', ({ module, onButton, onRow }) => {
    const found = selectors(css(module));
    expect(found).not.toContain(onButton);
    expect(found).toContain(onRow);
  });
});
