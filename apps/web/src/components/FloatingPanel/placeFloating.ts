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
  // From the row to the panel, and from the row's right edge in to the panel's.
  gap?: number;
  inset?: number;
}

export interface FloatingPlacement {
  top: number;
  left: number;
  height: number;
  up: boolean;
  originX: number;
}

// The dropdown placement of SPEC §5.5, shared by the dropdowns, the calendar and the ••• menus.
const EDGE = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export function placeFloating({
  anchor,
  size,
  viewport,
  minHeight = size.height,
  gap = 4,
  inset = 6,
}: PlaceFloatingInput): FloatingPlacement {
  const left = clamp(anchor.right - inset - size.width, EDGE, viewport.width - EDGE - size.width);
  const spaceBelow = viewport.height - EDGE - (anchor.bottom + gap);
  const spaceAbove = anchor.top - gap - EDGE;
  // It opens above only when it doesn't fit below; when neither side fits, the roomier side wins.
  const up = size.height > spaceBelow && (size.height <= spaceAbove || spaceAbove > spaceBelow);
  const height = Math.max(minHeight, Math.min(size.height, up ? spaceAbove : spaceBelow));
  const wanted = up ? anchor.top - gap - height : anchor.bottom + gap;
  // A panel that can't shrink enough covers part of its row rather than leave the screen.
  const top = clamp(wanted, EDGE, viewport.height - EDGE - height);
  return {
    top: Math.round(top),
    left: Math.round(left),
    height: Math.round(height),
    up,
    originX: Math.round(clamp(anchor.right - inset - left, 0, size.width)),
  };
}
