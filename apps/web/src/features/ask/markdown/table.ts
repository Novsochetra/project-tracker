import type { Align } from './types';

const DELIMITER = /^:?-+:?$/;

// A table holds at most this many cells, its head included; rows past it show as text. A cell can
// cost one character, so without a cap an answer of pipes laid out a page too big to show.
export const MAX_TABLE_CELLS = 5_000;

export interface TableHead {
  align: Align[];
  head: string[];
}

const cellText = (text: string): string => text.replace(/\\\|/g, '|').trim();

// "\|" is a pipe inside a cell.
export function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells: string[] = [];
  let start = 0;
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] === '\\') i += 1;
    else if (row[i] === '|') {
      cells.push(cellText(row.slice(start, i)));
      start = i + 1;
    }
  }
  cells.push(cellText(row.slice(start)));
  return cells;
}

function alignOf(cell: string): Align {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return left ? 'left' : null;
}

function delimiterRow(line: string): Align[] | null {
  if (!line.includes('|')) return null;
  const cells = splitRow(line);
  return cells.every((cell) => DELIMITER.test(cell)) ? cells.map(alignOf) : null;
}

export function tableAt(lines: readonly string[], at: number): TableHead | null {
  const header = lines[at];
  const below = lines[at + 1];
  if (!header?.includes('|') || below === undefined) return null;
  const align = delimiterRow(below);
  if (!align) return null;
  const head = splitRow(header);
  return align.length === head.length && head.length <= MAX_TABLE_CELLS ? { align, head } : null;
}
