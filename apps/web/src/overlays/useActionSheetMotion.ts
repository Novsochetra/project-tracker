import { useCallback, useRef, type RefObject } from 'react';
import { useAxisDrag } from '../gestures/useAxisDrag';
import { useTopPull } from '../gestures/useTopPull';
import { usePrefersReducedMotion } from '../lib/media';
import { useDismissDrag } from './useDismissDrag';
import { useBottomPanelValues, useSlidePresence, type BottomPanelValues } from './useSlidePresence';

export interface ActionSheetMotionInput {
  open: boolean;
  onClose: () => void;
  onExited: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  cardRef: RefObject<HTMLDivElement | null>;
}

const isWithin = (container: HTMLElement | null, target: EventTarget | null): boolean =>
  container !== null && target instanceof Node && container.contains(target);

export function useActionSheetMotion(input: ActionSheetMotionInput): BottomPanelValues {
  const { open, onClose, onExited, panelRef, cardRef } = input;
  const reducedMotion = usePrefersReducedMotion();
  const releaseVelocityRef = useRef(0);
  const values = useBottomPanelValues();
  const { y } = values;
  // Measured from the resting position, so an exit that starts mid-drag still leaves the screen.
  const measureTravel = useCallback(() => {
    const panel = panelRef.current;
    return panel ? window.innerHeight - (panel.getBoundingClientRect().top - y.get()) : null;
  }, [panelRef, y]);
  useSlidePresence({
    enabled: true,
    open,
    reducedMotion,
    values,
    measureTravel,
    releaseVelocityRef,
    onExited,
  });
  const drag = useDismissDrag({
    enabled: open,
    open,
    y,
    travel: values.travel,
    measureTravel,
    releaseVelocityRef,
    onClose,
  });
  // A finger on the card scrolls its rows when they don't fit (a phone turned sideways), so there
  // the sheet follows a pull down from their top, as a bottom sheet's body does. A mouse can't
  // scroll by dragging, so its drag moves the sheet from anywhere, as before.
  useAxisDrag(panelRef, {
    ...drag,
    axis: 'y',
    accept: (event) => event.pointerType === 'mouse' || !isWithin(cardRef.current, event.target),
  });
  useTopPull(cardRef, { ...drag, stretchWhenFits: true });
  return values;
}
