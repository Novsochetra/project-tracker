import type { DropTarget } from '@tracker/shared';
import type { RefObject } from 'react';
import { isPhoneNow } from '../../../lib/media';
import { shownTops } from '../../projects/reorder/reorderRows';
import { autoScrollStep, scrollAlong } from './autoScroll';
import { dropTargetAt, sameTarget } from './dropTarget';
import { holdSource, listRows, measureList, showPlacement, topInGroup } from './listRows';
import type { MeasuredList } from './listRows';
import { groupsAt, listPlacement, NO_PLACEMENT, placedGroups, type Placement } from './listShift';
import type { TicketDragEnvironment } from './useTicketDrag';

export interface ListElements {
  groups: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
}

export interface ListDragSession {
  env: TicketDragEnvironment;
  // After the drag's first render, which shows the empty groups' drop zones.
  measure: () => void;
}

// Each row's top within its group as the list shows it now, the dragged one left out.
export function shownInGroups(container: HTMLElement | null, ticketId: string) {
  const shown = shownTops(listRows(container), topInGroup);
  shown.delete(ticketId);

  return shown;
}

// Rows are measured once. Each frame reads only where the list is (it scrolls) and writes
// transforms, so the rows slide aside to open the gap where the ticket lands; only crossing into
// another group folds its row away and grows that group, which the measurements account for.
export function listDrag(
  { groups, scroller }: ListElements,
  ticketId: string,
  onEnd: (target: DropTarget | null) => void,
): ListDragSession {
  let measured: MeasuredList | null = null;
  let shownTarget: DropTarget | null = null;
  let placement: Placement = NO_PLACEMENT;

  const follow = (target: DropTarget | null): void => {
    if (!measured || sameTarget(target, shownTarget)) return;
    shownTarget = target;
    placement = listPlacement(measured.shiftGroups, ticketId, target, measured.step);
    showPlacement(measured, ticketId, placement);
  };

  let asked = { y: NaN, offset: NaN, target: null as DropTarget | null };

  // A group that grows or shrinks moves the rows under a still pointer, so the target stays what
  // the list shows until the pointer or the list moves: a drop lands where the gap is.
  const targetAt = (y: number): DropTarget | null => {
    const container = groups.current;
    if (!measured || !container) return null;
    const offset = container.getBoundingClientRect().top;
    if (y === asked.y && offset === asked.offset) return asked.target;
    const placed = placedGroups(measured.groups, ticketId, placement, measured.step);
    asked = { y, offset, target: dropTargetAt(groupsAt(placed, offset), y, ticketId) };

    return asked.target;
  };

  const env: TicketDragEnvironment = {
    targetAt: (point) => targetAt(point.y),
    autoScroll: (point) =>
      scrollAlong(scroller.current, 'y', autoScrollStep(point.y, window.innerHeight, isPhoneNow())),
    follow,
    end: onEnd,
  };

  const measure = (): void => {
    const container = groups.current;
    if (measured || !container) return;
    measured = measureList(container, ticketId);
    holdSource(measured, ticketId);
  };

  return { env, measure };
}
