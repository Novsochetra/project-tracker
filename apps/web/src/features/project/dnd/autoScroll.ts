export const AUTO_SCROLL_TOP = 72;
export const AUTO_SCROLL_BOTTOM_DESKTOP = 40;
export const AUTO_SCROLL_BOTTOM_PHONE = 96;
export const AUTO_SCROLL_INTERVAL_MS = 16;

const SPEED_DIVISOR = 5;

/** Pixels to scroll this tick: faster the further the pointer is into the top or bottom zone. */
export function autoScrollStep(pointerY: number, viewportHeight: number, isPhone: boolean): number {
  const bottomZone = isPhone ? AUTO_SCROLL_BOTTOM_PHONE : AUTO_SCROLL_BOTTOM_DESKTOP;
  const bottomEdge = viewportHeight - bottomZone;
  if (pointerY < AUTO_SCROLL_TOP) return -Math.ceil((AUTO_SCROLL_TOP - pointerY) / SPEED_DIVISOR);
  if (pointerY > bottomEdge) return Math.ceil((pointerY - bottomEdge) / SPEED_DIVISOR);
  return 0;
}
