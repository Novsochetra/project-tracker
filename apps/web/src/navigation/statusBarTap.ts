export const RESTING_Y = 1;

export interface StatusBarTapOptions {
  onTap: () => void;
  isLocked: () => boolean;
}

const TOUCH_EVENTS = ['touchstart', 'touchend', 'touchcancel'] as const;
const LISTEN = { capture: true, passive: true } as const;

// iOS scrolls the document to the top on a status-bar tap. The window rests 1px down, so the tap
// shows up as a scroll to 0. Only a scroll to 0 from rest counts: a finger dragging, the keyboard
// moving the page or a sheet pinning the body take the window to 0 too.
export function watchStatusBarTap(
  win: Window,
  { onTap, isLocked }: StatusBarTapOptions,
): () => void {
  let resting = false;
  let touching = false;
  const rest = () => {
    win.scrollTo(0, RESTING_Y);
    resting = win.scrollY === RESTING_Y;
  };
  const onTouch = (event: Event) => {
    touching = (event as TouchEvent).touches.length > 0;
    if (!touching && win.scrollY === 0 && !isLocked()) rest();
  };
  const onScroll = () => {
    if (isLocked()) return;
    if (touching) {
      resting = false;
    } else if (win.scrollY === 0) {
      if (resting) onTap();
      rest();
    } else {
      resting = win.scrollY === RESTING_Y;
    }
  };
  TOUCH_EVENTS.forEach((type) => win.addEventListener(type, onTouch, LISTEN));
  win.addEventListener('scroll', onScroll, { passive: true });
  if (!isLocked()) rest();
  return () => {
    TOUCH_EVENTS.forEach((type) => win.removeEventListener(type, onTouch, LISTEN));
    win.removeEventListener('scroll', onScroll);
  };
}
