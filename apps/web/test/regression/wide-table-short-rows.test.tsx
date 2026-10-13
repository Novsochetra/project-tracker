import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../../src/features/ask/markdown/Markdown';
import { parseMarkdown } from '../../src/features/ask/markdown/parseMarkdown';
import { MAX_TABLE_CELLS } from '../../src/features/ask/markdown/table';

// PT-188 review: every row of a table was padded to the header's width, so a header of many
// empty cells over many one-pipe rows made width × rows cells from 100,000 characters: 1.1 s at
// 50 columns, 15.7 s at 1,000, out of memory at 5,000, and a 40,000-character answer of 50
// columns took 58 s to show at 375px (a million cells).

const SIZE = 100_000;
// A browser takes a moment for what used to take seconds or never ended; the budget is wide.
const BUDGET_MS = 1_000;

function wideTable(columns: number, size: number): string {
  const head = `|${' |'.repeat(columns)}\n|${'-|'.repeat(columns)}\n`;
  return head + '|\n'.repeat(Math.max(0, Math.floor((size - head.length) / 2)));
}

const cellsOf = (text: string): number =>
  parseMarkdown(text).reduce(
    (sum, block) =>
      block.kind === 'table'
        ? sum + block.head.length + block.rows.reduce((cells, row) => cells + row.length, 0)
        : sum,
    0,
  );

describe('regression: a wide table with many short rows', () => {
  it.each([50, 200, 1_000, 5_000])('parses %i columns in time', (columns) => {
    const text = wideTable(columns, SIZE);
    const start = performance.now();
    const cells = cellsOf(text);
    expect(performance.now() - start).toBeLessThan(BUDGET_MS);
    expect(cells).toBeLessThanOrEqual(MAX_TABLE_CELLS);
  });

  it('keeps the page to a bounded number of cells', () => {
    const { container } = render(<Markdown text={wideTable(50, 40_000)} />);
    expect(container.querySelectorAll('th, td').length).toBeLessThanOrEqual(MAX_TABLE_CELLS);
  });
});
