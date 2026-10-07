import type { MotionValue } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { haptic } from './haptics';
import { isNoSwipeTarget, isPointerClaimed, swallowTapClick } from './pointerClaims';
import {
  isFullSwipe,
  restingOffset,
  swipeOffset,
  swipeOutcome,
  type SwipeGeometry,
  type SwipeOutcome,
  type SwipeSide,
} from './swipeActionsMath';
import { closeOtherRows, markRowClosed, markRowOpen } from './swipeRegistry';
import type { SwipeAction } from './swipeTypes';
import { useAxisDrag } from './useAxisDrag';
import { useSwipeMotion } from './useSwipeMotion';

export interface SwipeRowInput {
  rootRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  leading: SwipeAction[];
  trailing: SwipeAction[];
  disabled: boolean;
}

export interface SwipeRow {
  x: MotionValue<number>;
  full: MotionValue<number>;
  openSide: SwipeSide | null;
  press: (action: SwipeAction) => void;
  onContentClick: (event: MouseEvent) => void;
}

const acceptTouch = (event: PointerEvent) =>
  event.pointerType !== 'mouse' &&
  !isPointerClaimed(event.pointerId) &&
  !isNoSwipeTarget(event.target);

function useCloseOnOutsideTouch(
  active: boolean,
  rootRef: RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      const { target } = event;
      if (!(target instanceof Element) || rootRef.current?.contains(target)) return;
      // Like iOS, a tap on another row only closes this one; other controls still work.
      if (target.closest('[data-swipe-row]')) swallowTapClick(event.pointerId);
      close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', close, true);
    };
  }, [active, rootRef, close]);
}

export function useSwipeRow({
  rootRef,
  contentRef,
  leading,
  trailing,
  disabled,
}: SwipeRowInput): SwipeRow {
  const { x, full, fullRef, moveTo, setFull } = useSwipeMotion();
  const [openSide, setOpenSide] = useState<SwipeSide | null>(null);
  const [token] = useState(() => Symbol('swipe-row'));
  const geometryRef = useRef<SwipeGeometry>({ rowWidth: 0, leadingCount: 0, trailingCount: 0 });
  const startRef = useRef(0);
  const close = useCallback(() => {
    moveTo(0, 0);
    setFull(false);
    setOpenSide(null);
    markRowClosed(token);
  }, [moveTo, setFull, token]);
  useEffect(() => () => markRowClosed(token), [token]);
  useCloseOnOutsideTouch(openSide !== null, rootRef, close);

  const settle = (outcome: SwipeOutcome, velocity: number) => {
    const geometry = geometryRef.current;
    if (outcome.kind === 'full') {
      const action = (outcome.side === 'leading' ? leading : trailing)[0];
      const away = outcome.side === 'leading' ? geometry.rowWidth : -geometry.rowWidth;
      // Slide all the way out first so the action reads as done, then come back.
      moveTo(away, velocity, () => {
        action?.onTrigger();
        close();
      });
      return;
    }
    if (outcome.kind === 'open') {
      moveTo(restingOffset(outcome, geometry), velocity);
      setOpenSide(outcome.side);
      markRowOpen(token, close);
      return;
    }
    moveTo(0, velocity);
    setOpenSide(null);
    markRowClosed(token);
  };

  useAxisDrag(contentRef, {
    axis: 'x',
    enabled: !disabled && leading.length + trailing.length > 0,
    accept: acceptTouch,
    onStart: () => {
      x.stop();
      startRef.current = x.get();
      const rowWidth = rootRef.current?.getBoundingClientRect().width ?? 0;
      geometryRef.current = {
        rowWidth,
        leadingCount: leading.length,
        trailingCount: trailing.length,
      };
      closeOtherRows(token);
    },
    onMove: (dx) => {
      const offset = swipeOffset(startRef.current + dx, geometryRef.current);
      x.set(offset);
      const past = isFullSwipe(offset, geometryRef.current.rowWidth);
      if (past === fullRef.current) return;
      haptic('selection');
      setFull(past);
    },
    onEnd: (velocity) => settle(swipeOutcome(x.get(), velocity, geometryRef.current), velocity),
  });

  const press = (action: SwipeAction) => {
    action.onTrigger();
    close();
  };
  // Tapping a swiped-open row only closes it, like iOS.
  const onContentClick = (event: MouseEvent) => {
    if (openSide === null) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  return { x, full, openSide, press, onContentClick };
}
