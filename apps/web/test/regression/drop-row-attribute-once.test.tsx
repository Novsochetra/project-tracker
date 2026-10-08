import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { listItem, STATUS, statuses } from '../../src/api/test/fixtures';
import { BoardCard } from '../../src/features/project/board/BoardCard';
import { measureGroups } from '../../src/features/project/dnd/measure';
import type { RowCallbacks } from '../../src/features/project/rowTypes';
import { TicketRow } from '../../src/features/project/TicketRow';

// Reviewer 43 and worker 45 (PT-71): the row attribute drops, measuring and focus read was written
// out in six places (TicketRow, BoardCard, dnd/measure, DragSession, useBoardLayout, rowHasFocus),
// so renaming it in one would quietly break drags or the focus a moved row takes back.

const SOURCE = join(import.meta.dirname, '../../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const callbacks: RowCallbacks = {
  open: vi.fn(),
  startDrag: vi.fn(),
  handleKeyDown: vi.fn(),
  advance: vi.fn(),
  chooseStatus: vi.fn(),
  confirmDelete: vi.fn(),
};

describe('regression: the drop row attribute is named in one place', () => {
  it('is written out only in dnd/dropRow.ts', () => {
    const naming = sourceFiles(SOURCE).filter((file) =>
      readFileSync(file, 'utf8').includes('data-drop-row'),
    );
    expect(naming.map((file) => relative(SOURCE, file))).toEqual([
      'features/project/dnd/dropRow.ts',
    ]);
    const datasets = sourceFiles(SOURCE).filter((file) =>
      readFileSync(file, 'utf8').includes('dataset.dropRow'),
    );
    expect(datasets).toEqual([]);
  });

  it('marks list rows and board cards the way measuring reads them', () => {
    const { container } = render(
      <section data-drop-group={STATUS.todo}>
        <TicketRow
          ticket={listItem(1, STATUS.todo, 0)}
          status={statuses[0]!}
          next={null}
          dragged={false}
          dropEdge={null}
          riseDelay={null}
          callbacks={callbacks}
        />
        <BoardCard
          ticket={listItem(2, STATUS.todo, 1)}
          status={statuses[0]!}
          dragged={false}
          dropEdge={null}
          callbacks={callbacks}
        />
      </section>,
    );
    const [group] = measureGroups(container);
    expect(group?.rows.map((row) => row.id)).toEqual(['t-1', 't-2']);
  });
});
