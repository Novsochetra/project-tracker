import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { lockAxis } from '../gestures/math';
import {
  claimPointer,
  isNoSwipeTarget,
  releasePointer,
  suppressNextClick,
} from '../gestures/pointerClaims';
import { VelocityTracker } from '../gestures/velocity';
import { isInEdgeZone, swipeBackProgress, type SwipeRelease } from './edgeSwipe';

export interface EdgeSwipeHandlers {
  enabled: boolean;
  onBegin: () => void;
  onProgress: (progress: number) => void;
  onRelease: (release: SwipeRelease) => void;
}

interface EdgeSession {
  id: number;
  startX: number;
  startY: number;
  width: number;
  engaged: boolean;
  tracker: VelocityTracker;
}

const AXIS_SLOP = 10;

function attachEdgeSwipe(root: HTMLElement, read: () => EdgeSwipeHandlers): () => void {
  let session: EdgeSession | null = null;

  const end = () => {
    if (session) releasePointer(session.id);
    session = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  };

  const onDown = (event: PointerEvent) => {
    if (session || !read().enabled || event.pointerType === 'mouse' || !event.isPrimary) return;
    const rect = root.getBoundingClientRect();
    if (!isInEdgeZone(event.clientX - rect.left) || isNoSwipeTarget(event.target)) return;
    claimPointer(event.pointerId);
    const tracker = new VelocityTracker();
    tracker.add(event.timeStamp, event.clientX, event.clientY);
    const { pointerId: id, clientX: startX, clientY: startY } = event;
    session = { id, startX, startY, width: rect.width, engaged: false, tracker };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const onMove = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.id) return;
    const dx = event.clientX - session.startX;
    if (!session.engaged) {
      const axis = lockAxis(dx, event.clientY - session.startY, AXIS_SLOP);
      if (axis === null) return;
      if (axis === 'y' || dx < 0) return end();
      session.engaged = true;
      read().onBegin();
    }
    session.tracker.add(event.timeStamp, event.clientX, event.clientY);
    read().onProgress(swipeBackProgress(dx, session.width));
  };

  const onUp = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.id) return;
    if (session.engaged) {
      const velocity = session.tracker.velocity(event.timeStamp).x;
      const distance = event.clientX - session.startX;
      read().onRelease({ distance, width: session.width, velocity });
      suppressNextClick();
    }
    end();
  };

  const onCancel = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.id) return;
    if (session.engaged) read().onRelease({ distance: 0, width: session.width, velocity: 0 });
    end();
  };

  root.addEventListener('pointerdown', onDown, { capture: true });
  return () => {
    root.removeEventListener('pointerdown', onDown, { capture: true });
    end();
  };
}

export function useEdgeSwipe(rootRef: RefObject<HTMLElement | null>, handlers: EdgeSwipeHandlers) {
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return attachEdgeSwipe(root, () => handlersRef.current);
  }, [rootRef]);
}
