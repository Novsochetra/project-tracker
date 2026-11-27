import type { DropTarget } from '@tracker/shared';
import { orderAfterDrop, rowShifts } from '../../projects/reorder/reorderMath';
import type { GroupBox } from './dropTarget';

export interface ShiftGroup {
  statusId: string;
  rowIds: readonly string[];
}

// How the list shows where the dragged ticket lands. Within its group the rows it passes slide one
// slot (`shifts`). Into another group the rows after the drop slide down, that group grows by a
// slot at its end (`grow`), and the ticket's own row folds away (`away`).
export interface Placement {
  shifts: Map<string, number>;
  grow: string | null;
  away: boolean;
}

export const NO_PLACEMENT: Placement = { shifts: new Map(), grow: null, away: false };

export function listPlacement(
  groups: readonly ShiftGroup[],
  draggedId: string,
  target: DropTarget | null,
  step: number,
): Placement {
  const group = groups.find((candidate) => candidate.statusId === target?.statusId);
  if (!target || !group) return NO_PLACEMENT;

  const across = !group.rowIds.includes(draggedId);
  const next = orderAfterDrop(group.rowIds, draggedId, target);
  const shifts = new Map(
    [...rowShifts(group.rowIds, next, step)].filter(([id, shift]) => id !== draggedId && shift),
  );
  // An empty group's drop zone is its slot already.
  const grow = across && group.rowIds.length > 0 ? group.statusId : null;

  return { shifts, grow, away: across };
}

// Where the groups and rows measured when the drag started are laid out under a placement, as a
// row folding away or a group growing moves everything below it.
export function placedGroups(
  groups: readonly GroupBox[],
  draggedId: string,
  { grow, away }: Pick<Placement, 'grow' | 'away'>,
  step: number,
): GroupBox[] {
  const dragged = groups.flatMap((group) => group.rows).find((row) => row.id === draggedId);
  const foldsAt = away && dragged ? dragged.top + dragged.height : Infinity;
  const growsAt = groups.find((group) => group.statusId === grow)?.bottom ?? Infinity;
  const place = (y: number): number =>
    y - (y >= foldsAt - 0.5 ? step : 0) + (y >= growsAt - 0.5 ? step : 0);

  return groups.map((group) => ({
    ...group,
    top: place(group.top),
    bottom: place(group.bottom),
    rows: group.rows.map((row) => ({ ...row, top: place(row.top) })),
  }));
}

// The groups moved to where the list is now (it scrolls).
export const groupsAt = (groups: readonly GroupBox[], offset: number): GroupBox[] =>
  groups.map((group) => ({
    ...group,
    top: group.top + offset,
    bottom: group.bottom + offset,
    rows: group.rows.map((row) => ({ ...row, top: row.top + offset })),
  }));
