import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { foldedHeight, lineHeightOf } from './foldMath';
import { lineEnds } from './lineEnds';

export interface FoldState {
  // The folded box's height while the text is long enough to fold, else null.
  height: number | null;
  expanded: boolean;
  folded: boolean;
  expand: () => void;
  // Takes the button pressed, so a fold that closes keeps it under the finger.
  toggle: (button: HTMLElement) => void;
}

// Text folds by its lines; other content, such as rows of files, brings its own rule. Null when
// the content is short enough to show whole.
export type FoldMeasure = (element: HTMLElement) => number | null;

const px = (value: string): number => Number.parseFloat(value) || 0;

function measureText(element: HTMLElement): number | null {
  const style = getComputedStyle(element);
  const padding = px(style.paddingTop) + px(style.paddingBottom);
  const border = px(style.borderTopWidth) + px(style.borderBottomWidth);
  return foldedHeight({
    text: element.scrollHeight - padding,
    lineHeight: lineHeightOf(style.lineHeight, style.fontSize),
    frame: padding + border,
    lineEnds: lineEnds(element),
  });
}

// Closing moves the button up by all it hid. Scrolling up as much keeps it where it was pressed,
// instead of leaving the reader far down the page.
function keepInPlace(button: HTMLElement, before: number): void {
  const scroller = button.closest<HTMLElement>('[data-stack-scroller]');
  const moved = button.getBoundingClientRect().top - before;
  if (scroller && moved !== 0) scroller.scrollTop += moved;
}

// Measures `ref`'s whole text: the element itself for a field, the text inside the clipped box
// otherwise. `content` changes with the text, for a field whose folded box doesn't resize.
export function useFold(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  content?: unknown,
  measure: FoldMeasure = measureText,
): FoldState {
  const [height, setHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const anchor = useRef<{ button: HTMLElement; top: number } | null>(null);
  // Stable, so an effect can open the fold when something lands past it.
  const expand = useCallback(() => setExpanded(true), []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element && enabled) setHeight(measure(element));
  }, [ref, enabled, content, measure]);

  // Fonts arriving, a turned phone and new text change the height without a render here.
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(measure(element)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled, measure]);

  useLayoutEffect(() => {
    const pending = anchor.current;
    anchor.current = null;
    if (pending) keepInPlace(pending.button, pending.top);
  }, [expanded]);

  // A window that grows past phone width turns folding off; the height measured before would
  // leave a Show more under the whole text.
  const shownHeight = enabled ? height : null;
  return {
    height: shownHeight,
    expanded,
    folded: shownHeight !== null && !expanded,
    expand,
    toggle: (button) => {
      if (expanded) anchor.current = { button, top: button.getBoundingClientRect().top };
      setExpanded(!expanded);
    },
  };
}
