export interface AnchorRect {
  top: number;
  right: number;
  bottom: number;
}

export interface VerticalBounds {
  top: number;
  bottom: number;
}

export type FloatingSide = 'up' | 'down';

export interface PlaceFloatingInput {
  anchor: AnchorRect;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  // A panel that scrolls (a long dropdown) shrinks to the room it has, down to this height.
  minHeight?: number;
  // From the row to the panel, and from the row's right edge in to the panel's.
  gap?: number;
  inset?: number;
  // The sheet the row sits in: a panel that fits inside it stays there rather than hang off its
  // edge over the dimmed page (PT-286).
  container?: VerticalBounds | undefined;
  // The side an open panel took: it keeps it while its content changes, so typing in the label
  // picker never flips it over its row, unless even its smallest height no longer fits there.
  side?: FloatingSide | undefined;
}

export interface FloatingPlacement {
  top: number;
  left: number;
  height: number;
  // All the height it may take on its side, for a panel whose content grows as it is used.
  room: number;
  up: boolean;
  originX: number;
}

// The dropdown placement of SPEC §5.5, shared by the dropdowns, the calendar and the ••• menus.
const EDGE = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export interface Room {
  below: number;
  above: number;
}

function roomIn(bounds: VerticalBounds, anchor: AnchorRect, gap: number, edge: number): Room {
  return {
    below: bounds.bottom - edge - (anchor.bottom + gap),
    above: anchor.top - gap - (bounds.top + edge),
  };
}

// Only the part of the sheet on screen counts.
const visiblePart = (container: VerticalBounds, screenHeight: number): VerticalBounds => ({
  top: Math.max(container.top, 0),
  bottom: Math.min(container.bottom, screenHeight),
});

export interface SideInput {
  height: number;
  minHeight: number;
  screen: Room;
  sheet: Room;
  side: FloatingSide | undefined;
}

// Below when it fits in the sheet, else above in the sheet, else the same on screen; when neither
// side fits even on screen, the roomier side wins and the panel scrolls.
export function pickSide({ height, minHeight, screen, sheet, side }: SideInput): boolean {
  if (side !== undefined && minHeight <= (side === 'up' ? screen.above : screen.below)) {
    return side === 'up';
  }

  if (height <= sheet.below) return false;

  if (height <= sheet.above) return true;

  if (height <= screen.below) return false;

  if (height <= screen.above) return true;

  return screen.above > screen.below;
}

export function placeFloating({
  anchor,
  size,
  viewport,
  minHeight = size.height,
  gap = 4,
  inset = 6,
  container,
  side,
}: PlaceFloatingInput): FloatingPlacement {
  const left = clamp(anchor.right - inset - size.width, EDGE, viewport.width - EDGE - size.width);

  const screen = roomIn({ top: 0, bottom: viewport.height }, anchor, gap, EDGE);
  // Up to the sheet's own edge: an inset there too sent a status menu that fits below up over the
  // sheet's title.
  const sheet = container
    ? roomIn(visiblePart(container, viewport.height), anchor, gap, 0)
    : screen;
  const up = pickSide({ height: size.height, minHeight, screen, sheet, side });
  const room = Math.max(minHeight, up ? screen.above : screen.below);
  const height = Math.min(size.height, room);

  const wanted = up ? anchor.top - gap - height : anchor.bottom + gap;
  // A panel that can't shrink enough covers part of its row rather than leave the screen.
  const top = clamp(wanted, EDGE, viewport.height - EDGE - height);

  return {
    top: Math.round(top),
    left: Math.round(left),
    height: Math.round(height),
    room: Math.round(room),
    up,
    originX: Math.round(clamp(anchor.right - inset - left, 0, size.width)),
  };
}
