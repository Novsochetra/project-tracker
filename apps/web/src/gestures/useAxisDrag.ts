import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { lockAxis, type Axis } from './math';
import { suppressNextClick } from './pointerClaims';
import { VelocityTracker } from './velocity';

export interface DragHandlers {
  enabled: boolean;
  onStart: () => void;
  onMove: (delta: number) => void;
  onEnd: (velocity: number) => void;
}

export interface AxisDragOptions extends DragHandlers {
  axis: Axis;
  accept?: (event: PointerEvent) => boolean;
}

interface DragSession {
  id: number;
  startX: number;
  startY: number;
  engaged: boolean;
  tracker: VelocityTracker;
}

const SLOP = 6;

// Taps on buttons inside still click: nothing engages until the pointer moves past the slop
// along the drag axis, and movement along the other axis abandons the drag.
function attachAxisDrag(target: HTMLElement, read: () => AxisDragOptions): () => void {
  let session: DragSession | null = null;
  const along = (point: { x: number; y: number }) => (read().axis === 'x' ? point.x : point.y);

  const end = () => {
    session = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  };

  const onDown = (event: PointerEvent) => {
    const options = read();
    if (session || !options.enabled || !event.isPrimary || event.button > 0) return;
    if (options.accept && !options.accept(event)) return;
    const tracker = new VelocityTracker();
    tracker.add(event.timeStamp, event.clientX, event.clientY);
    const { pointerId: id, clientX: startX, clientY: startY } = event;
    session = { id, startX, startY, engaged: false, tracker };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const onMove = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.id) return;
    const delta = { x: event.clientX - session.startX, y: event.clientY - session.startY };
    if (!session.engaged) {
      const axis = lockAxis(delta.x, delta.y, SLOP);
      if (axis === null) return;
      if (axis !== read().axis) return end();
      session.engaged = true;
      read().onStart();
    }
    session.tracker.add(event.timeStamp, event.clientX, event.clientY);
    read().onMove(along(delta));
  };

  const onUp = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.id) return;
    if (session.engaged) {
      read().onEnd(along(session.tracker.velocity(event.timeStamp)));
      suppressNextClick();
    }
    end();
  };

  const onCancel = (event: PointerEvent) => {
    if (!session || event.pointerId !== session.id) return;
    if (session.engaged) read().onEnd(0);
    end();
  };

  target.addEventListener('pointerdown', onDown);
  return () => {
    target.removeEventListener('pointerdown', onDown);
    end();
  };
}

export function useAxisDrag(targetRef: RefObject<HTMLElement | null>, options: AxisDragOptions) {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    return attachAxisDrag(target, () => optionsRef.current);
  }, [targetRef]);
}
