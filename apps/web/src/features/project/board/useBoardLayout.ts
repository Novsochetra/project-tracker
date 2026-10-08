import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { measurePage, revealDistance, spanOf } from './boardSpans';

export const MIN_BOARD_HEIGHT = 320;
export const REVEAL_MARGIN = 16;

// Offsets ignore transforms, so a screen still sliding or rising in measures where it will rest.
function offsetWithin(element: HTMLElement, ancestor: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return top;
}

function observeSizes(elements: readonly Element[], onResize: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }
  const observer = new ResizeObserver(onResize);
  elements.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
}

function siblingsAbove(element: Element): Element[] {
  const above: Element[] = [];
  for (let node = element.previousElementSibling; node; node = node.previousElementSibling) {
    above.push(node);
  }
  return above;
}

// Fills the screen below the filters so the columns scroll on their own, not the page.
export function useFillHeight(
  frameRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const scroller = scrollRef.current;
    if (!frame || !scroller) return;
    const fit = () => {
      const height = Math.floor(scroller.clientHeight - offsetWithin(frame, scroller));
      frame.style.setProperty('--board-height', `${Math.max(height, MIN_BOARD_HEIGHT)}px`);
    };
    fit();
    return observeSizes([scroller, ...siblingsAbove(frame)], fit);
  }, [frameRef, scrollRef]);
}

export function useBoardPage(
  boardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  count: number,
): number {
  const [page, setPage] = useState(0);
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !enabled) return;
    const update = () => setPage(measurePage(board));
    board.addEventListener('scroll', update, { passive: true });
    return () => board.removeEventListener('scroll', update);
  }, [boardRef, enabled]);
  return Math.min(page, Math.max(count - 1, 0));
}

export function useRevealFocusedCard(boardRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const reveal = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest('[data-drop-row]');
      // Only keyboard focus: a press that focused a card must not slide it from under the pointer.
      if (!card || !target?.matches(':focus-visible')) return;
      const { left, right } = board.getBoundingClientRect();
      const view = { left: left + REVEAL_MARGIN, right: right - REVEAL_MARGIN };
      board.scrollLeft += revealDistance(spanOf(card), view);
    };
    board.addEventListener('focusin', reveal);
    return () => board.removeEventListener('focusin', reveal);
  }, [boardRef]);
}
