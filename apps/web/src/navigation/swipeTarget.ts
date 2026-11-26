import { isNoSwipeTarget } from '../gestures/pointerClaims';
import { hasOpenOverlay } from '../lib/openOverlay';

// A field scrolls its own text however its style reads.
const isField = (element: Element) => element.matches('input, textarea');

function scrollsSideways(element: Element): boolean {
  if (element.scrollWidth <= element.clientWidth + 1) return false;
  if (isField(element)) return true;
  const { overflowX } = getComputedStyle(element);

  return overflowX === 'auto' || overflowX === 'scroll';
}

function insideSidewaysScroller(target: Element): boolean {
  for (let node: Element | null = target; node; node = node.parentElement) {
    if (scrollsSideways(node)) return true;
  }

  return false;
}

// A sideways swipe over a board, a tab row, a code block or a field with long text scrolls it; a
// page change there would take the person away mid-scroll. One while a sheet, dropdown or menu is
// open is meant for that, not for the page behind it.
export function isTrackpadSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || isNoSwipeTarget(target)) return false;

  return !insideSidewaysScroller(target) && !hasOpenOverlay(document);
}
