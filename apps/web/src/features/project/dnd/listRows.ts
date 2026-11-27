import { moveRow, STILL_ATTRIBUTE, type RowElements } from '../../projects/reorder/reorderRows';
import { DROP_GROUP_ATTRIBUTE, dropGroupId, dropGroupsIn } from './dropGroup';
import { dropRowId, dropRowsIn } from './dropRow';
import type { GroupBox } from './dropTarget';
import type { Placement, ShiftGroup } from './listShift';

export const GROUP_END_ATTRIBUTE = 'data-group-end';
// The dragged ticket's row isn't drawn: the ghost is the ticket, and the gap the rows open is
// where it lands. While the ticket is over another group the row folds away (TicketRow.module.css).
export const DRAG_SOURCE_ATTRIBUTE = 'data-drag-source';
export const DRAG_AWAY_ATTRIBUTE = 'data-drag-away';

export interface MeasuredList {
  // Relative to the list's top, so a scroll only moves them all.
  groups: GroupBox[];
  shiftGroups: ShiftGroup[];
  rows: RowElements;
  ends: RowElements;
  step: number;
}

// A row's top within its group, so a group that comes or goes above it on the drop moves it with
// its group instead of gliding it.
export function topInGroup(element: Element): number {
  const top = element.getBoundingClientRect().top;
  const group = element.closest(`[${DROP_GROUP_ATTRIBUTE}]`);

  return group ? top - group.getBoundingClientRect().top : top;
}

export function listRows(container: HTMLElement | null): RowElements {
  return new Map(container ? dropRowsIn(container).map((row) => [dropRowId(row), row]) : []);
}

// What follows each group's rows (Show more, Move all to Done), by status id.
export function groupEnds(container: HTMLElement | null): RowElements {
  const ends = container?.querySelectorAll<HTMLElement>(`[${GROUP_END_ATTRIBUTE}]`) ?? [];

  return new Map([...ends].map((end) => [end.getAttribute(GROUP_END_ATTRIBUTE) ?? '', end]));
}

function measureGroup(section: HTMLElement, listTop: number): GroupBox {
  const rect = section.getBoundingClientRect();
  const rows = dropRowsIn(section).map((row) => {
    const box = row.getBoundingClientRect();

    return { id: dropRowId(row), top: box.top - listTop, height: box.height };
  });

  return {
    statusId: dropGroupId(section),
    top: rect.top - listTop,
    bottom: rect.bottom - listTop,
    left: rect.left,
    right: rect.right,
    rows,
  };
}

// Read once, after the drag's first render showed the empty groups. Offsets left from an earlier
// frame would move what is read, so they come off first.
export function measureList(container: HTMLElement, draggedId: string): MeasuredList {
  const rows = listRows(container);
  for (const row of rows.values()) row.style.transform = '';
  const listTop = container.getBoundingClientRect().top;
  const groups = dropGroupsIn(container).map((section) => measureGroup(section, listTop));
  const dragged = groups.flatMap((group) => group.rows).find((row) => row.id === draggedId);

  return {
    groups,
    shiftGroups: groups.map((group) => ({
      statusId: group.statusId,
      rowIds: group.rows.map((row) => row.id),
    })),
    rows,
    ends: groupEnds(container),
    step: dragged?.height ?? 0,
  };
}

// One frame's look: the rows slide, the ticket's own row folds away or comes back, and the group
// it enters grows by a slot at its end. Only a fold or a growth lays the list out again.
export function showPlacement(measured: MeasuredList, draggedId: string, placement: Placement) {
  const { shifts, grow, away } = placement;
  for (const [id, row] of measured.rows) {
    if (id !== draggedId) moveRow(row, shifts.get(id) ?? 0);
  }

  const source = measured.rows.get(draggedId);
  source?.toggleAttribute(DRAG_AWAY_ATTRIBUTE, away);
  if (source) source.style.height = away ? '0px' : `${measured.step}px`;
  for (const [statusId, end] of measured.ends) {
    end.style.paddingTop = statusId === grow ? `${measured.step}px` : '';
  }
}

export function holdSource(measured: MeasuredList, draggedId: string): void {
  const source = measured.rows.get(draggedId);
  source?.setAttribute(DRAG_SOURCE_ATTRIBUTE, '');
  // A height to fold from: a transition can't start from auto.
  if (source) source.style.height = `${measured.step}px`;
}

// Undoes the drag's look at once, for the move's own render to take over. Returns what lets the
// parts animate again, once the rows' new places have been read.
export function releaseList(container: HTMLElement | null): () => void {
  const ends = [...groupEnds(container).values()];
  const sources = [
    ...(container?.querySelectorAll<HTMLElement>(`[${DRAG_SOURCE_ATTRIBUTE}]`) ?? []),
  ];
  const parts = [...ends, ...sources];
  for (const part of parts) part.setAttribute(STILL_ATTRIBUTE, '');
  for (const end of ends) end.style.paddingTop = '';
  for (const source of sources) {
    source.removeAttribute(DRAG_SOURCE_ATTRIBUTE);
    source.removeAttribute(DRAG_AWAY_ATTRIBUTE);
    source.style.height = '';
  }

  return () => {
    for (const part of parts) part.removeAttribute(STILL_ATTRIBUTE);
  };
}
