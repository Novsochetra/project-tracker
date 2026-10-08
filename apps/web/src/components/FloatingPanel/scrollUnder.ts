import { wheelPixels, type WheelLike } from '../../lib/wheelPixels';

const SCROLLS = new Set(['auto', 'scroll', 'overlay']);

interface Axis {
  overflow: string;
  offset: number;
  room: number;
  by: number;
}

// The page itself scrolls unless it is hidden; other elements only with overflow auto or scroll.
function canScrollAxis({ overflow, offset, room, by }: Axis, isPage: boolean): boolean {
  const scrolls = SCROLLS.has(overflow) || (isPage && overflow !== 'hidden');
  if (by === 0 || !scrolls) return false;
  return by < 0 ? offset > 0 : offset < room;
}

export function canScroll(element: Element, x: number, y: number): boolean {
  const style = getComputedStyle(element);
  const isPage = element === document.scrollingElement;
  const vertical = {
    overflow: style.overflowY,
    offset: element.scrollTop,
    room: element.scrollHeight - element.clientHeight,
    by: y,
  };
  const horizontal = {
    overflow: style.overflowX,
    offset: element.scrollLeft,
    room: element.scrollWidth - element.clientWidth,
    by: x,
  };
  return canScrollAxis(vertical, isPage) || canScrollAxis(horizontal, isPage);
}

export function scrollerFor(start: Element | undefined, x: number, y: number): Element | null {
  for (let element = start ?? null; element; element = element.parentElement) {
    if (canScroll(element, x, y)) return element;
  }
  return null;
}

// The layer over the page takes the wheel, and the browser would scroll only the layer's own
// ancestors, never the app's scrolling areas under it; so the wheel goes to the one under it.
export function scrollUnder(layer: Element, wheel: WheelLike) {
  const under = document
    .elementsFromPoint(wheel.clientX, wheel.clientY)
    .find((element) => element !== layer);
  const direction = wheelPixels(wheel, 1);
  const scroller = scrollerFor(under, direction.x, direction.y);
  if (!scroller) return;
  const { x, y } = wheelPixels(wheel, scroller.clientHeight);
  scroller.scrollBy({ left: x, top: y });
}
