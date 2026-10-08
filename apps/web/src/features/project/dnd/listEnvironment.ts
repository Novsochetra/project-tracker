import type { RefObject } from 'react';
import { isPhoneNow } from '../../../lib/media';
import { autoScrollStep, scrollAlong } from './autoScroll';
import type { DragEnvironment } from './DragSession';
import { dropTargetAt } from './dropTarget';
import { measureGroups } from './measure';

export interface ListElements {
  groups: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
}

/** The list: groups stack vertically and the whole screen scrolls near its top and bottom. */
export function listEnvironment(
  { groups, scroller }: ListElements,
  ticketId: string,
): DragEnvironment {
  return {
    targetAt: (point) => dropTargetAt(measureGroups(groups.current), point.y, ticketId),
    autoScroll: (point) =>
      scrollAlong(scroller.current, 'y', autoScrollStep(point.y, window.innerHeight, isPhoneNow())),
  };
}
