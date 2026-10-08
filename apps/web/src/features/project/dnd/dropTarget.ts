import type { DropTarget } from '@tracker/shared';

export interface RowBox {
  id: string;
  top: number;
  height: number;
}

export interface GroupBox {
  statusId: string;
  top: number;
  bottom: number;
  rows: RowBox[];
}

export type DropEdge = 'before' | 'after';

const distanceTo = (group: GroupBox, y: number): number => {
  if (y < group.top) return group.top - y;
  return y > group.bottom ? y - group.bottom : 0;
};

/** The group under `y`, or the nearest one when `y` is above, below or between groups. */
export function groupAt(groups: readonly GroupBox[], y: number): GroupBox | null {
  let nearest: GroupBox | null = null;
  let best = Infinity;
  for (const group of groups) {
    const distance = distanceTo(group, y);
    if (distance < best) {
      nearest = group;
      best = distance;
    }
  }
  return nearest;
}

export function insertionIndex(rows: readonly RowBox[], y: number): number {
  const index = rows.findIndex((row) => y < row.top + row.height / 2);
  return index < 0 ? rows.length : index;
}

export function dropTargetAt(
  groups: readonly GroupBox[],
  y: number,
  draggedId: string,
): DropTarget | null {
  const group = groupAt(groups, y);
  if (!group) return null;
  const rows = group.rows.filter((row) => row.id !== draggedId);
  const index = insertionIndex(rows, y);
  return {
    statusId: group.statusId,
    beforeId: rows[index]?.id ?? null,
    afterId: rows[index - 1]?.id ?? null,
  };
}

export const sameTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.statusId === b.statusId &&
    (a.beforeId ?? null) === (b.beforeId ?? null) &&
    (a.afterId ?? null) === (b.afterId ?? null));

/** The drop line sits above the row the ticket lands before, or below the last row. */
export function dropEdgeFor(target: DropTarget | null, ticketId: string): DropEdge | null {
  if (!target) return null;
  if (target.beforeId === ticketId) return 'before';
  return !target.beforeId && target.afterId === ticketId ? 'after' : null;
}
