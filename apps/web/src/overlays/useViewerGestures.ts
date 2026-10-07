import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { createViewerGestures } from './viewerGestures';
import type { ViewerGestureContext } from './viewerModes';

export function useViewerGestures(
  stageRef: RefObject<HTMLElement | null>,
  context: ViewerGestureContext,
) {
  const contextRef = useRef(context);
  useLayoutEffect(() => {
    contextRef.current = context;
  });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const gestures = createViewerGestures(() => contextRef.current);
    const onDown = (event: PointerEvent) => {
      // Keeps the gesture alive when a mouse leaves the window mid-drag.
      if (typeof stage.setPointerCapture === 'function') stage.setPointerCapture(event.pointerId);
      gestures.down(event);
    };
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', gestures.move);
    stage.addEventListener('pointerup', gestures.up);
    stage.addEventListener('pointercancel', gestures.up);
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', gestures.move);
      stage.removeEventListener('pointerup', gestures.up);
      stage.removeEventListener('pointercancel', gestures.up);
      gestures.dispose();
    };
  }, [stageRef]);
}
