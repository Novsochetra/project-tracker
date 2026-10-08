import { useEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotionNow } from '../lib/media';
import { lastEditedField } from './useEditingText';

export interface Edges {
  top: number;
  bottom: number;
}

const GAP_ABOVE_BAR = 8;

/** How far to scroll up so `field` ends above a bar `barHeight` tall at the screen's bottom. */
export function scrollToClearBar(field: Edges, screenBottom: number, barHeight: number): number {
  const limit = screenBottom - barHeight - GAP_ABOVE_BAR;
  if (field.top >= screenBottom || field.bottom <= limit) return 0;
  return Math.ceil(field.bottom - limit);
}

function keepInSight(field: HTMLElement, bar: HTMLElement, scroller: HTMLElement): void {
  if (!scroller.contains(field)) return;
  // A field's actions, such as the comment box's Comment button, sit in its form below it.
  const box = (field.closest('form') ?? field).getBoundingClientRect();
  const top = scrollToClearBar(box, scroller.getBoundingClientRect().bottom, bar.offsetHeight);
  if (top > 0)
    scroller.scrollBy({ top, behavior: prefersReducedMotionNow() ? 'instant' : 'smooth' });
}

/** When the bar comes back after editing, the field that was edited ends up above it. */
export function useKeepFieldInSight(
  bar: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null> | undefined,
  editing: boolean,
): void {
  const wasEditing = useRef(editing);
  useEffect(() => {
    const back = wasEditing.current && !editing;
    wasEditing.current = editing;
    const element = bar.current;
    if (!back || !element) return;
    const keep = () => {
      const field = lastEditedField();
      if (field && scroller?.current) keepInSight(field, element, scroller.current);
    };
    const slidIn = (event: TransitionEvent) => {
      if (event.target === element) keep();
    };
    // Not before the next frame: a tap that ended editing is still landing in this task, and
    // content moving under it would take its click. Once more when the bar is in, because what
    // ended editing can still move the field: a sent comment appears above the box.
    const frame = requestAnimationFrame(keep);
    element.addEventListener('transitionend', slidIn);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('transitionend', slidIn);
    };
  }, [bar, scroller, editing]);
}
