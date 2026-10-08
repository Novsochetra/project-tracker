export const AUTO_SCROLL_TOP = 72;
export const AUTO_SCROLL_BOTTOM_DESKTOP = 40;
export const AUTO_SCROLL_BOTTOM_PHONE = 96;
export const AUTO_SCROLL_INTERVAL_MS = 16;

const SPEED_DIVISOR = 5;

export interface EdgeZones {
  start: number;
  end: number;
  // On the board the pointer can rest far outside a column (over the sidebar), so the speed stops
  // growing at the zone's edge; the list keeps the SPEC's ever-faster scroll past the window edge.
  capped?: boolean;
}

const stepFor = (distance: number, zone: number, capped: boolean): number =>
  Math.ceil((capped ? Math.min(distance, zone) : distance) / SPEED_DIVISOR);

export function edgeScrollStep(
  position: number,
  start: number,
  end: number,
  zones: EdgeZones,
): number {
  const capped = zones.capped ?? false;
  const intoStart = start + zones.start - position;
  if (intoStart > 0) return -stepFor(intoStart, zones.start, capped);
  const intoEnd = position - (end - zones.end);
  if (intoEnd > 0) return stepFor(intoEnd, zones.end, capped);
  return 0;
}

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
