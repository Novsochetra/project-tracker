export interface AnchorRect {
  top: number;
  right: number;
  bottom: number;
}

export interface PlacePopoverInput {
  anchor: AnchorRect;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
}

export interface PopoverPlacement {
  top: number;
  left: number;
  up: boolean;
  originX: number;
}

// The same placement as the Status dropdown (SPEC §5.5), with the popover's measured size.
const EDGE = 8;
const GAP = 4;
const INSET = 6;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export function placePopover({ anchor, size, viewport }: PlacePopoverInput): PopoverPlacement {
  const left = clamp(anchor.right - INSET - size.width, EDGE, viewport.width - EDGE - size.width);
  const spaceBelow = viewport.height - EDGE - (anchor.bottom + GAP);
  const spaceAbove = anchor.top - GAP - EDGE;
  const up = size.height > spaceBelow && (size.height <= spaceAbove || spaceAbove > spaceBelow);
  const wanted = up ? anchor.top - GAP - size.height : anchor.bottom + GAP;
  // When neither side has room it covers part of the row rather than leave the screen.
  const top = clamp(wanted, EDGE, viewport.height - EDGE - size.height);
  return {
    top: Math.round(top),
    left: Math.round(left),
    up,
    originX: Math.round(clamp(anchor.right - INSET - left, 0, size.width)),
  };
}
