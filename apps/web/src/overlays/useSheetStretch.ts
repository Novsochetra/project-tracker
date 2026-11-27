import { useTransform, type MotionValue } from 'motion/react';

// A floating phone sheet pulled up past its height grows from the top, as iOS's does, instead of
// lifting off the bottom and showing the page under it: the upward part of the pull becomes
// extra padding at its foot (--sheet-stretch in Sheet.module.css).
export const shownOffset = (offset: number): number => Math.max(0, offset);
export const stretchOf = (offset: number): string => `${Math.max(0, -offset)}px`;

export function useSheetStretch(y: MotionValue<number>) {
  const shown = useTransform(y, shownOffset);
  const stretch = useTransform(y, stretchOf);

  return { y: shown, '--sheet-stretch': stretch };
}
