import type { Label } from '@tracker/shared';
import { vi } from 'vitest';

// New ticket at 1280×800 as Chromium lays it out: the sheet, and its Labels row, the last one.
export const SHEET = { top: 80, bottom: 552 };
export const LABELS_ROW = { top: 490, bottom: 534, left: 386, right: 893 };
export const FIELD_HEIGHT = 40;
// The field and the empty state's three lines.
export const EMPTY_HEIGHT = 132;
const ROW_HEIGHT = 36;

export const label = (id: string, name: string, position: number): Label => ({
  id,
  projectId: 'p1',
  name,
  color: '#B42318',
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});

const rect = (box: { top: number; bottom: number; left?: number; right?: number }): DOMRect =>
  DOMRect.fromRect({
    x: box.left ?? 370,
    y: box.top,
    width: (box.right ?? 910) - (box.left ?? 370),
    height: box.bottom - box.top,
  });

// What the menu holds, as tall as Chromium draws it, up to the max-height placement gave it.
function menuHeight(menu: HTMLElement): number {
  const rows = menu.querySelectorAll('[role="option"]').length;
  const natural = menu.textContent?.includes('No labels yet')
    ? EMPTY_HEIGHT
    : FIELD_HEIGHT + 12 + rows * ROW_HEIGHT;
  const most = parseFloat(menu.style.maxHeight);

  return Number.isNaN(most) ? natural : Math.min(natural, most);
}

export function stubLayout(): () => void {
  const root = document.documentElement;
  Object.defineProperty(root, 'clientWidth', { configurable: true, value: 1280 });
  Object.defineProperty(root, 'clientHeight', { configurable: true, value: 800 });

  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get');
  height.mockImplementation(function measured(this: HTMLElement) {
    return this.getAttribute('aria-label') === 'Pick labels' ? menuHeight(this) : 0;
  });
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(264);
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  boxes.mockImplementation(function box(this: Element) {
    const id = this.getAttribute('data-testid');
    if (id === 'sheet') return rect(SHEET);

    return id === 'row' ? rect(LABELS_ROW) : rect({ top: 0, bottom: 0 });
  });

  return () => {
    [height, width, boxes].forEach((spy) => spy.mockRestore());
    Reflect.deleteProperty(root, 'clientWidth');
    Reflect.deleteProperty(root, 'clientHeight');
  };
}

// Where the field is drawn: at the menu's top, or at its bottom where it comes last.
export function fieldTop(menu: HTMLElement): number {
  const top = parseFloat(menu.parentElement!.style.top);
  const fieldLast = menu.querySelector('[data-field]')?.getAttribute('data-field') === 'last';

  return fieldLast ? top + menu.offsetHeight - 4 - FIELD_HEIGHT : top + 4;
}
