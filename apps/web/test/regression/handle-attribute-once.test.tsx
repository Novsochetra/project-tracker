import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { listItem, STATUS } from '../../src/api/test/fixtures';
import { requestHandleFocus, wantsHandleFocus } from '../../src/features/project/dnd/handleFocus';
import { DragHandle } from '../../src/features/project/DragHandle';

// The drag handle's attribute was written out in DragHandle.tsx and undo/useMoveToast.ts besides
// dnd/handleFocus.ts, so renaming it in one place would quietly stop a moved ticket's handle from
// taking focus back after a keyboard move or its Undo.

const SOURCE = join(import.meta.dirname, '../../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('regression: the drag handle attribute is named in one place', () => {
  it('is written out only in dnd/handleFocus.ts', () => {
    const naming = sourceFiles(SOURCE).filter((file) =>
      readFileSync(file, 'utf8').includes('data-handle-for'),
    );
    expect(naming.map((file) => relative(SOURCE, file))).toEqual([
      'features/project/dnd/handleFocus.ts',
    ]);
  });

  it('marks the rendered handle the way a focus request looks for it', () => {
    requestHandleFocus('t-3');
    render(
      <DragHandle
        ticket={listItem(3, STATUS.todo, 0)}
        onPointerDown={() => undefined}
        onKeyDown={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /^Move MOB-3\./ })).toHaveFocus();
    expect(wantsHandleFocus('t-3')).toBe(true);
  });
});
