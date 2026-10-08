export const AUTO_SCROLL_TOP = 72;
export const AUTO_SCROLL_BOTTOM_DESKTOP = 40;
export const AUTO_SCROLL_BOTTOM_PHONE = 96;
export const AUTO_SCROLL_INTERVAL_MS = 16;

const SPEED_DIVISOR = 5;

export interface EdgeZones {
  start: number;
  end: number;
}

/**
 * Pixels to scroll this tick when `position` is within a zone at either end of `start`–`end`:
 * faster the further in, and no faster once the pointer leaves the far side of the zone.
 */
export function edgeScrollStep(
  position: number,
  start: number,
  end: number,
  zones: EdgeZones,
): number {
  const intoStart = start + zones.start - position;
  if (intoStart > 0) return -Math.ceil(Math.min(intoStart, zones.start) / SPEED_DIVISOR);
  const intoEnd = position - (end - zones.end);
  if (intoEnd > 0) return Math.ceil(Math.min(intoEnd, zones.end) / SPEED_DIVISOR);
  return 0;
}

/** Pixels to scroll the screen this tick: faster the further into the top or bottom zone. */
export function autoScrollStep(pointerY: number, viewportHeight: number, isPhone: boolean): number {
  const bottomZone = isPhone ? AUTO_SCROLL_BOTTOM_PHONE : AUTO_SCROLL_BOTTOM_DESKTOP;
  return edgeScrollStep(pointerY, 0, viewportHeight, { start: AUTO_SCROLL_TOP, end: bottomZone });
}

/** Scrolls `element` by `step` along one axis; true when it actually moved. */
export function scrollAlong(element: HTMLElement | null, axis: 'x' | 'y', step: number): boolean {
  if (!element || step === 0) return false;
  const property = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const before = element[property];
  element[property] = before + step;
  return element[property] !== before;
}
