import { useLayoutEffect, type RefObject } from 'react';
import { peekHeight, type RowSpan } from './rowPeek';

function rowSpans(card: HTMLElement): RowSpan[] {
  const top = card.getBoundingClientRect().top - card.scrollTop;
  return [...card.querySelectorAll(':scope > button')].map((row) => {
    const box = row.getBoundingClientRect();
    return { top: box.top - top, height: box.height };
  });
}

function fitCard(card: HTMLElement): void {
  card.style.maxHeight = '';
  const height = peekHeight(card.getBoundingClientRect().height, rowSpans(card));
  if (height !== null) card.style.maxHeight = `${height}px`;
}

// A card of rows that scrolls ends partway through a row, so it can't look complete (PT-117). Again
// when the rows change (a next step) and when the screen does (turned, Safari's bars).
export function useRowPeek(cardRef: RefObject<HTMLElement | null>, content: string): void {
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const fit = () => fitCard(card);
    fit();
    window.addEventListener('resize', fit);
    // A caption that rewraps as the web font arrives moves the rows (PT-129). The rows rather than
    // the card: a capped card keeps its size as they grow, and the cap set here resizes the card.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    for (const row of card.children) observer?.observe(row, { box: 'border-box' });
    return () => {
      window.removeEventListener('resize', fit);
      observer?.disconnect();
    };
  }, [cardRef, content]);
}
