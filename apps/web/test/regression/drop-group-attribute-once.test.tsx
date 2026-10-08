import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Worker 52 (PT-55/PT-71), PT-74: like the row attribute before it, the group attribute that
// drops, measuring and the board's paging read was written out in TicketGroup, BoardColumn,
// dnd/measure and board/boardSpans, so renaming it in one would quietly break drags or paging.

const SOURCE = join(import.meta.dirname, '../../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const naming = (text: string) =>
  sourceFiles(SOURCE)
    .filter((file) => readFileSync(file, 'utf8').includes(text))
    .map((file) => relative(SOURCE, file));

describe('regression: the drop group attribute is named in one place', () => {
  it('is written out only in dnd/dropGroup.ts', () => {
    expect(naming('data-drop-group')).toEqual(['features/project/dnd/dropGroup.ts']);
    expect(naming('dataset.dropGroup')).toEqual([]);
  });
});
