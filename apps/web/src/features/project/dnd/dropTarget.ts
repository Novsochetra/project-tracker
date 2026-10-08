import type { DropTarget } from '@tracker/shared';

export interface Point {
  x: number;
  y: number;
}

export interface RowBox {
  id: string;
  top: number;
  height: number;
}

export interface GroupBox {
  statusId: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  rows: RowBox[];
}

export type DropEdge = 'before' | 'after';

const distanceTo = (start: number, end: number, value: number): number => {
  if (value < start) return start - value;
  return value > end ? value - end : 0;
};

function nearest<T>(
  items: readonly T[],
  value: number,
  span: (item: T) => readonly [number, number],
): T | null {
  let found: T | null = null;
  let best = Infinity;
  for (const item of items) {
    const [start, end] = span(item);
    const distance = distanceTo(start, end, value);
    if (distance < best) {
      found = item;
      best = distance;
    }
  }
  return found;
}

export const groupAt = <T extends { top: number; bottom: number }>(
  groups: readonly T[],
  y: number,
): T | null => nearest(groups, y, (group) => [group.top, group.bottom]);

export const columnAt = <T extends { left: number; right: number }>(
  columns: readonly T[],
  x: number,
): T | null => nearest(columns, x, (column) => [column.left, column.right]);

export function insertionIndex(rows: readonly RowBox[], y: number): number {
  const index = rows.findIndex((row) => y < row.top + row.height / 2);
  return index < 0 ? rows.length : index;
}

export function targetInGroup(group: GroupBox, y: number, draggedId: string): DropTarget {
  const rows = group.rows.filter((row) => row.id !== draggedId);
  const index = insertionIndex(rows, y);
  return {
    statusId: group.statusId,
    beforeId: rows[index]?.id ?? null,
    afterId: rows[index - 1]?.id ?? null,
  };
}

export function dropTargetAt(
  groups: readonly GroupBox[],
  y: number,
  draggedId: string,
): DropTarget | null {
  const group = groupAt(groups, y);
  return group ? targetInGroup(group, y, draggedId) : null;
}

export function columnDropTarget(
  columns: readonly GroupBox[],
  point: Point,
  draggedId: string,
): DropTarget | null {
  const column = columnAt(columns, point.x);
  return column ? targetInGroup(column, point.y, draggedId) : null;
}

export const sameTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.statusId === b.statusId &&
    (a.beforeId ?? null) === (b.beforeId ?? null) &&
    (a.afterId ?? null) === (b.afterId ?? null));

export function dropEdgeFor(target: DropTarget | null, ticketId: string): DropEdge | null {
  if (!target) return null;
  if (target.beforeId === ticketId) return 'before';
  return !target.beforeId && target.afterId === ticketId ? 'after' : null;
}
