import type { FloatingPlacement } from '../../components/FloatingPanel';

// Where the menu's field sat when it opened: its top edge below the row, its bottom edge above it,
// where the field sits last.
export interface OpenedAt {
  anchorTop: number;
  up: boolean;
  fieldEdge: number;
}

export interface SteadyPlacement {
  placement: FloatingPlacement;
  opened: OpenedAt;
}

// Typing changes how many rows the label menu holds, so it grows and shrinks; its field stays where
// it opened (PT-286), and the menu grows and shrinks away from it, toward the row or past it. Once
// the row moved (a resize), or the menu changed sides, it is placed afresh.
export function steadyPlacement(
  placement: FloatingPlacement,
  anchorTop: number,
  opened: OpenedAt | null,
): SteadyPlacement {
  const same = opened !== null && opened.anchorTop === anchorTop && opened.up === placement.up;
  if (!same) {
    const fieldEdge = placement.up ? placement.top + placement.height : placement.top;

    return { placement, opened: { anchorTop, up: placement.up, fieldEdge } };
  }

  const top = placement.up ? opened.fieldEdge - placement.height : opened.fieldEdge;

  return { placement: { ...placement, top }, opened };
}
