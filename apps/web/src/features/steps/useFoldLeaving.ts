import { useLayoutEffect, type RefObject } from 'react';
import { canAnimate, foldMotion } from './rowMotion';

const NEW_LEAVERS = 'li[data-leaving]:not([data-folding])';
const STAYING = 'li[data-folding]:not([data-leaving])';

// A row that stops leaving keeps its node, so its fold, held at the end, is undone.
function unfold(container: HTMLElement | null): void {
  container?.querySelectorAll<HTMLElement>(STAYING).forEach((row) => {
    row.getAnimations().forEach((animation) => animation.cancel());
    delete row.dataset.folding;
  });
}

// The rows a new step pushed out fold together, sharing one length worked out from their total
// height, so a batch of steps moves the list no faster than one row would. Each stays folded
// (fill) until React drops it.
export function useFoldLeaving(
  ref: RefObject<HTMLElement | null>,
  change: unknown,
  onLeft: (seq: number) => void,
): void {
  useLayoutEffect(() => {
    unfold(ref.current);
    const rows = [...(ref.current?.querySelectorAll<HTMLElement>(NEW_LEAVERS) ?? [])];
    const heights = rows.map((row) => row.getBoundingClientRect().height);
    const motion = foldMotion(heights.reduce((sum, height) => sum + height, 0));
    rows.forEach((row) => {
      const seq = Number(row.dataset.seq);
      row.dataset.folding = '';
      if (!canAnimate(row)) {
        onLeft(seq);
        return;
      }
      const { height, paddingTop, paddingBottom } = getComputedStyle(row);
      const frames = [
        { height, paddingTop, paddingBottom, opacity: 1 },
        { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 },
      ];
      row.animate(frames, { ...motion, fill: 'forwards' }).onfinish = () => onLeft(seq);
    });
  }, [ref, change, onLeft]);
}
