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

const along = (room: Room, side: FloatingSide): number => (side === 'up' ? room.above : room.below);

// Where it can, a panel keeps this far inside the sheet its row sits in.
const SHEET_INSET = 6;

export interface Rooms {
  screen: Room;
  // In the sheet, up to its edge and up to SHEET_INSET from it; the screen's when there is none.
  flush: Room;
  inset: Room;
  sheet: VerticalBounds | undefined;
}

function roomsFor(
  anchor: AnchorRect,
  screenHeight: number,
  gap: number,
  container: VerticalBounds | undefined,
): Rooms {
  const screen = roomIn({ top: 0, bottom: screenHeight }, anchor, gap, EDGE);
  if (!container) return { screen, flush: screen, inset: screen, sheet: undefined };

  // Only the part of the sheet on screen counts.
  const sheet = {
    top: Math.max(container.top, 0),
    bottom: Math.min(container.bottom, screenHeight),
  };

  return {
    screen,
    flush: roomIn(sheet, anchor, gap, 0),
    inset: roomIn(sheet, anchor, gap, SHEET_INSET),
    sheet,
  };
}

export interface SideInput {
  height: number;
  minHeight: number;
  rooms: Rooms;
  side: FloatingSide | undefined;
}

// Whole in the sheet, below then above; else shrunk to the sheet on its roomier side, where it may
// scroll; else whole on screen, below then above; else the screen's roomier side. Measured to the
// sheet's own edge, as an inset there sent a status menu that fits below up over the sheet's title.
export function pickSide({ height, minHeight, rooms, side }: SideInput): FloatingSide {
  const { screen, flush, inset } = rooms;
  if (side !== undefined && minHeight <= along(screen, side)) return side;

  if (height <= flush.below) return 'down';

  if (height <= flush.above) return 'up';

  const roomier = inset.above > inset.below ? 'up' : 'down';
  if (rooms.sheet && minHeight <= along(inset, roomier)) return roomier;

  if (height <= screen.below) return 'down';

  if (height <= screen.above) return 'up';

  return screen.above > screen.below ? 'up' : 'down';
}

function roomOn(side: FloatingSide, rooms: Rooms, height: number, minHeight: number): number {
  if (rooms.sheet && height <= along(rooms.flush, side)) return along(rooms.flush, side);

  if (rooms.sheet && minHeight <= along(rooms.inset, side)) return along(rooms.inset, side);

  return Math.max(minHeight, along(rooms.screen, side));
}

// A panel that fits its sheet only flush with the edge moves toward its row to keep SHEET_INSET
// from the edge: by the row's 4px gap and 2px over the row at most.
const NUDGE = 6;

function nudgedInto(sheet: VerticalBounds, top: number, height: number, up: boolean): number {
  if (up) {
    return top >= sheet.top ? Math.min(top + NUDGE, Math.max(top, sheet.top + SHEET_INSET)) : top;
  }

  const limit = sheet.bottom - SHEET_INSET - height;

  return top + height <= sheet.bottom ? Math.max(top - NUDGE, Math.min(top, limit)) : top;
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

  const rooms = roomsFor(anchor, viewport.height, gap, container);
  const taken = pickSide({ height: size.height, minHeight, rooms, side });
  const room = roomOn(taken, rooms, size.height, minHeight);
  const height = Math.min(size.height, room);
  const up = taken === 'up';

  const wanted = up ? anchor.top - gap - height : anchor.bottom + gap;
  const nudged = rooms.sheet ? nudgedInto(rooms.sheet, wanted, height, up) : wanted;
  // A panel that can't shrink enough covers part of its row rather than leave the screen.
  const top = clamp(nudged, EDGE, viewport.height - EDGE - height);

  return {
    top: Math.round(top),
    left: Math.round(left),
    height: Math.round(height),
    room: Math.round(room),
    up,
    originX: Math.round(clamp(anchor.right - inset - left, 0, size.width)),
  };
}
