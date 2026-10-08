import { useEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotionNow } from '../lib/media';
import { lastEditedField } from './useEditingText';

export interface Edges {
  top: number;
  bottom: number;
}

const GAP_ABOVE_BAR = 8;
// A sent comment shows at once, before the tracker answers. What lands later, such as an agent's
// report, pushes the box down like any other content.
const FOLLOW_SENT_MS = 1000;

type Plan = (box: Edges, view: Edges, barHeight: number) => number;

// A box taller than the room between `view`'s top and the bar stays where it is: its end would
// only come up by pushing the part just edited off the top.
export const scrollToClearBar: Plan = (box, view, barHeight) => {
  const limit = view.bottom - barHeight - GAP_ABOVE_BAR;
  const fits = box.bottom - box.top <= limit - view.top;
  return fits && box.bottom > limit ? Math.ceil(box.bottom - limit) : 0;
};

export const scrollAfterEditing: Plan = (box, view, barHeight) =>
  box.top >= view.bottom ? 0 : scrollToClearBar(box, view, barHeight);

// The screen's nav bar sticks over the top of its scroller.
function viewOf(scroller: HTMLElement): Edges {
  const { top, bottom } = scroller.getBoundingClientRect();
  const navBar = scroller.querySelector('[data-navbar]');
  return { top: navBar ? navBar.getBoundingClientRect().bottom : top, bottom };
}

// To a position, not by a distance: WebKit runs a smooth scroll on its own thread, so while the
// page is busy the scroll moves on from where the page measured the box, and a distance added to
// that later spot overshot.
function keepInSight(box: HTMLElement, bar: HTMLElement, scroller: HTMLElement, plan: Plan): void {
  const distance = plan(box.getBoundingClientRect(), viewOf(scroller), bar.offsetHeight);
  if (distance <= 0) return;
  const behavior = prefersReducedMotionNow() ? 'instant' : 'smooth';
  scroller.scrollTo({ top: scroller.scrollTop + distance, behavior });
}

// A field's actions, such as the comment box's Comment button, sit in its form below it.
const boxOf = (field: HTMLElement): HTMLElement => field.closest('form') ?? field;

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
    // Not before the next frame: a tap that ended editing is still landing in this task, and
    // content moving under it would take its click. Only once: a second scroll would pull back a
    // user who scrolled meanwhile; what a sent form adds is followed by useKeepSentFormInSight.
    const frame = requestAnimationFrame(() => {
      const field = lastEditedField();
      const view = scroller?.current;
      if (field && view?.contains(field))
        keepInSight(boxOf(field), element, view, scrollAfterEditing);
    });
    return () => cancelAnimationFrame(frame);
  }, [bar, scroller, editing]);
}

// What the form sent lands above it and pushes it down, even below the screen. A touch or a
// scroll ends the hold: the user has taken over.
function holdInSight(form: HTMLElement, bar: HTMLElement, scroller: HTMLElement): () => void {
  if (typeof ResizeObserver === 'undefined') return () => undefined;
  const observer = new ResizeObserver(() => {
    // A comment edit's form goes away once it is saved.
    if (form.isConnected) keepInSight(form, bar, scroller, scrollToClearBar);
    else release();
  });
  for (let node: HTMLElement | null = form; node && node !== scroller; node = node.parentElement)
    observer.observe(node);
  const timer = setTimeout(release, FOLLOW_SENT_MS);
  function release() {
    clearTimeout(timer);
    observer.disconnect();
    scroller.removeEventListener('pointerdown', release, true);
    scroller.removeEventListener('wheel', release, true);
  }
  scroller.addEventListener('pointerdown', release, true);
  scroller.addEventListener('wheel', release, { capture: true, passive: true });
  return release;
}

// Follows the send itself, since the keyboard may have closed long before it.
export function useKeepSentFormInSight(
  bar: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null> | undefined,
  shown: boolean,
): void {
  useEffect(() => {
    const element = bar.current;
    const view = scroller?.current;
    if (!shown || !element || !view) return;
    let release: () => void = () => undefined;
    const sent = (event: SubmitEvent) => {
      release();
      if (event.target instanceof HTMLFormElement)
        release = holdInSight(event.target, element, view);
    };
    view.addEventListener('submit', sent);
    return () => {
      view.removeEventListener('submit', sent);
      release();
    };
  }, [bar, scroller, shown]);
}
