import { useLayoutEffect, useRef, type RefObject } from 'react';
import { canAnimate, foldMotion, shrinkFrames } from './gentleShrink';

// The row whose words were just cut eases from its old height to the new one, rather than the
// whole list jumping by the lines it lost in one frame.
export function useRowShrink(ref: RefObject<HTMLElement | null>, cut: boolean): void {
  const height = useRef<number | null>(null);
  const wasCut = useRef(cut);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const next = row.getBoundingClientRect().height;
    const from = wasCut.current === cut ? null : height.current;
    const frames = shrinkFrames(from, next);
    wasCut.current = cut;
    height.current = next;
    if (frames && from !== null && canAnimate(row)) row.animate(frames, foldMotion(from - next));
  });
}

// It stays folded at the end (fill), since the row goes only once React hears it finished.
export function useRowLeave(
  ref: RefObject<HTMLElement | null>,
  { leaving, seq, onLeft }: { leaving: boolean; seq: number; onLeft: (seq: number) => void },
): void {
  useLayoutEffect(() => {
    const row = ref.current;
    if (!leaving || !row) return undefined;
    if (!canAnimate(row)) {
      onLeft(seq);
      return undefined;
    }
    const { height, paddingTop, paddingBottom } = getComputedStyle(row);
    const frames = [
      { height, paddingTop, paddingBottom, opacity: 1 },
      { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 },
    ];
    const px = row.getBoundingClientRect().height;
    const animation = row.animate(frames, { ...foldMotion(px), fill: 'forwards' });
    animation.onfinish = () => onLeft(seq);
    return () => {
      animation.onfinish = null;
    };
  }, [ref, leaving, seq, onLeft]);
}
