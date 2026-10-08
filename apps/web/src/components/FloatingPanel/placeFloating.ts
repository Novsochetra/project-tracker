export interface AnchorRect {
  top: number;
  right: number;
  bottom: number;
}

export interface PlaceFloatingInput {
  anchor: AnchorRect;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  // A panel that scrolls (a long dropdown) shrinks to the room it has, down to this height.
  minHeight?: number;
}

export interface FloatingPlacement {
  top: number;
  left: number;
  height: number;
  up: boolean;
  originX: number;
}

// The dropdown placement of SPEC §5.5, shared by the dropdowns and the calendar.
const EDGE = 8;
const GAP = 4;
const INSET = 6;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export function placeFloating({
  anchor,
  size,
  viewport,
  minHeight = size.height,
}: PlaceFloatingInput): FloatingPlacement {
  const left = clamp(anchor.right - INSET - size.width, EDGE, viewport.width - EDGE - size.width);
  const spaceBelow = viewport.height - EDGE - (anchor.bottom + GAP);
  const spaceAbove = anchor.top - GAP - EDGE;
  // It opens above only when it doesn't fit below; when neither side fits, the roomier side wins.
  const up = size.height > spaceBelow && (size.height <= spaceAbove || spaceAbove > spaceBelow);
  const height = Math.max(minHeight, Math.min(size.height, up ? spaceAbove : spaceBelow));
  const wanted = up ? anchor.top - GAP - height : anchor.bottom + GAP;
  // A panel that can't shrink enough covers part of its row rather than leave the screen.
  const top = clamp(wanted, EDGE, viewport.height - EDGE - height);
  return {
    top: Math.round(top),
    left: Math.round(left),
    height: Math.round(height),
    up,
    originX: Math.round(clamp(anchor.right - INSET - left, 0, size.width)),
  };
}
