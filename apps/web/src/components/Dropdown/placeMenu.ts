export interface MenuRect {
  top: number;
  right: number;
  bottom: number;
}

export interface PlaceMenuInput {
  triggerRect: MenuRect;
  viewport: { width: number; height: number };
  itemCount: number;
  isPhone: boolean;
}

export interface MenuPlacement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  up: boolean;
  originX: number;
}

const EDGE = 8;
const GAP = 4;
const INSET = 6;
const CHROME = 10;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export function placeMenu({
  triggerRect,
  viewport,
  itemCount,
  isPhone,
}: PlaceMenuInput): MenuPlacement {
  const width = isPhone ? 240 : 220;
  const itemHeight = isPhone ? 44 : 36;
  const height = itemCount * itemHeight + CHROME;
  const left = clamp(triggerRect.right - width - INSET, EDGE, viewport.width - width - EDGE);
  const spaceBelow = viewport.height - EDGE - (triggerRect.bottom + GAP);
  const spaceAbove = triggerRect.top - GAP - EDGE;
  const fitsBelow = height <= spaceBelow;
  // The SPEC opens upward only when the menu fits above; with many statuses neither side may
  // fit, so the roomier side wins and the menu scrolls.
  const up = !fitsBelow && (height <= spaceAbove || spaceAbove > spaceBelow);
  const room = up ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(itemHeight + CHROME, Math.min(height, room));
  const top = up ? triggerRect.top - GAP - maxHeight : triggerRect.bottom + GAP;
  return {
    top: Math.round(top),
    left: Math.round(left),
    width,
    maxHeight: Math.round(maxHeight),
    up,
    originX: Math.round(clamp(triggerRect.right - left, 0, width)),
  };
}
