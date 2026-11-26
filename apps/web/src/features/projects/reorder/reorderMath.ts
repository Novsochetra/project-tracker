import type { DropTarget } from '@tracker/shared';
import type { RowBox } from '../../project/dnd/dropTarget';

export function orderAfterDrop(
  ids: readonly string[],
  movedId: string,
  target: DropTarget,
): string[] {
  const rest = ids.filter((id) => id !== movedId);
  const before = target.beforeId ? rest.indexOf(target.beforeId) : -1;
  const at = before < 0 ? rest.length : before;
  return [...rest.slice(0, at), movedId, ...rest.slice(at)];
}

// The rows between the dragged row's place and its new one each move by one slot: the dragged
// row's height and the gap under a row.
export function slotStep(rows: readonly RowBox[], from: number): number {
  const [first, second] = rows;
  const gap = first && second ? second.top - first.top - first.height : 0;
  return (rows[from]?.height ?? 0) + gap;
}

export function rowShifts(
  ids: readonly string[],
  next: readonly string[],
  step: number,
): Map<string, number> {
  const nextIndex = new Map(next.map((id, index) => [id, index]));
  return new Map(
    ids.map((id, index) => [id, Math.sign((nextIndex.get(id) ?? index) - index) * step]),
  );
}

// The dragged row stays within the list, so it can't be dropped on the section label or the
// account row.
export function clampOffset(rows: readonly RowBox[], from: number, offset: number): number {
  const row = rows[from];
  const first = rows[0];
  const last = rows.at(-1);
  if (!row || !first || !last) return 0;
  const min = first.top - row.top;
  const max = last.top + last.height - (row.top + row.height);
  return Math.min(Math.max(offset, min), max);
}
