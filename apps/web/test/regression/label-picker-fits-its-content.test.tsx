import { screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, sheetTestSetup } from '../../src/app/test/renderWithApi';
import { LabelMenu } from '../../src/features/labels/LabelMenu';

// PT-286: in a project without labels, New ticket's label picker (1280×800) hung past the bottom of
// the sheet, and its empty state was cut under the field: the menu's height was guessed from a
// count of rows (two rows, 82px) and the field stuck to the top of the scrolling menu, so the
// "No labels yet" lines scrolled under it. The menu is now measured, given the room on its side,
// and opens above its row where it would hang off the sheet.

const SHEET = { top: 80, bottom: 552 };
const LABELS_ROW = { top: 490, bottom: 534, left: 386, right: 893 };
// The field and the empty state's three lines, as Chromium lays them out.
const CONTENT_HEIGHT = 132;

const rect = (box: { top: number; bottom: number; left?: number; right?: number }): DOMRect =>
  DOMRect.fromRect({
    x: box.left ?? 370,
    y: box.top,
    width: (box.right ?? 910) - (box.left ?? 370),
    height: box.bottom - box.top,
  });

function NewTicketLabels() {
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div role="dialog" aria-label="New ticket" data-testid="sheet">
      <button ref={anchorRef} type="button" data-testid="row">
        Labels
      </button>
      <LabelMenu
        open
        anchorRef={anchorRef}
        projectKey="MOB"
        labels={[]}
        value={[]}
        onChange={() => undefined}
        onClose={() => undefined}
      />
    </div>
  );
}

let restore: Array<() => void> = [];

function stubLayout() {
  const root = document.documentElement;
  const size = (name: 'clientWidth' | 'clientHeight', value: number) => {
    Object.defineProperty(root, name, { configurable: true, value });
    restore.push(() => Reflect.deleteProperty(root, name));
  };

  size('clientWidth', 1280);
  size('clientHeight', 800);

  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get');
  height.mockImplementation(function measured(this: HTMLElement) {
    return this.getAttribute('aria-label') === 'Pick labels' ? CONTENT_HEIGHT : 0;
  });
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(264);
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  boxes.mockImplementation(function box(this: Element) {
    const id = this.getAttribute('data-testid');
    if (id === 'sheet') return rect(SHEET);

    return id === 'row' ? rect(LABELS_ROW) : rect({ top: 0, bottom: 0 });
  });
  restore.push(() => [height, width, boxes].forEach((spy) => spy.mockRestore()));
}

beforeEach(() => {
  restore = [sheetTestSetup()];
  stubLayout();
});

afterEach(() => restore.forEach((undo) => undo()));

describe('regression: the label picker fits what it holds, inside its sheet', () => {
  it('is never shorter than its empty state, and opens above the last row of the sheet', () => {
    renderWithApi(<NewTicketLabels />);
    const menu = screen.getByRole('dialog', { name: 'Pick labels' });
    expect(screen.getByText('No labels yet')).toBeInTheDocument();

    expect(menu.dataset.up).toBe('true');
    expect(parseFloat(menu.style.maxHeight)).toBeGreaterThanOrEqual(CONTENT_HEIGHT);
    const frame = menu.parentElement!;
    expect(parseFloat(frame.style.top)).toBe(LABELS_ROW.top - 4 - CONTENT_HEIGHT);
    expect(parseFloat(frame.style.top)).toBeGreaterThanOrEqual(SHEET.top);
  });
});
