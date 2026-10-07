import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { canScrollUpWithin, decidePull } from './topPull';
import { VelocityTracker } from './velocity';

export interface TopPullOptions {
  enabled: boolean;
  scrollRef?: RefObject<HTMLElement | null>;
  onStart: () => void;
  onMove: (dy: number) => void;
  onEnd: (velocityY: number) => void;
}

interface PullSession {
  startX: number;
  startY: number;
  engaged: boolean;
  tracker: VelocityTracker;
}

// Touch events, not pointer events: only a cancelable touchmove can stop the browser's own
// overscroll once we decide the downward drag is ours.
function attachTopPull(target: HTMLElement, read: () => TopPullOptions): () => void {
  let session: PullSession | null = null;
  const scroller = () => read().scrollRef?.current ?? target;

  const onStart = (event: TouchEvent) => {
    session = null;
    const touch = event.touches[0];
    if (!read().enabled || event.touches.length !== 1 || !touch) return;
    const container = scroller();
    if (container.scrollTop > 0 || canScrollUpWithin(event.target, container)) return;
    const tracker = new VelocityTracker();
    session = { startX: touch.clientX, startY: touch.clientY, engaged: false, tracker };
  };

  const onMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!session || !touch) return;
    const dy = touch.clientY - session.startY;
    if (!session.engaged) {
      const decision = decidePull(touch.clientX - session.startX, dy, scroller().scrollTop);
      if (decision === 'wait') return;
      if (decision === 'ignore') {
        session = null;
        return;
      }
      session.engaged = true;
      read().onStart();
    }
    if (event.cancelable) event.preventDefault();
    session.tracker.add(event.timeStamp, touch.clientX, touch.clientY);
    read().onMove(dy);
  };

  const finish = (velocityY: (s: PullSession) => number) => {
    if (session?.engaged) read().onEnd(velocityY(session));
    session = null;
  };
  const onEnd = (event: TouchEvent) => finish((s) => s.tracker.velocity(event.timeStamp).y);
  const onCancel = () => finish(() => 0);

  target.addEventListener('touchstart', onStart, { passive: true });
  target.addEventListener('touchmove', onMove, { passive: false });
  target.addEventListener('touchend', onEnd);
  target.addEventListener('touchcancel', onCancel);
  return () => {
    target.removeEventListener('touchstart', onStart);
    target.removeEventListener('touchmove', onMove);
    target.removeEventListener('touchend', onEnd);
    target.removeEventListener('touchcancel', onCancel);
  };
}

export function useTopPull(
  targetRef: RefObject<HTMLElement | null>,
  options: TopPullOptions,
): void {
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    return attachTopPull(target, () => optionsRef.current);
  }, [targetRef]);
}
