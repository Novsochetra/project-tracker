export const RESTING_Y = 1;
// Safari moves the window to 0 itself within a frame or two of a resize (its toolbar, the
// keyboard, a rotation) or of a finger lifting, so a scroll to 0 that soon is not a tap.
export const SETTLE_MS = 300;

export interface StatusBarTapOptions {
  onTap: () => void;
  isLocked: () => boolean;
}

const TOUCH_EVENTS = ['touchstart', 'touchend', 'touchcancel'] as const;
const LISTEN = { capture: true, passive: true } as const;

function listen(win: Window, onTouch: (event: Event) => void, onResize: () => void): () => void {
  TOUCH_EVENTS.forEach((type) => win.addEventListener(type, onTouch, LISTEN));
  win.addEventListener('resize', onResize);
  win.visualViewport?.addEventListener('resize', onResize);
  return () => {
    TOUCH_EVENTS.forEach((type) => win.removeEventListener(type, onTouch, LISTEN));
    win.removeEventListener('resize', onResize);
    win.visualViewport?.removeEventListener('resize', onResize);
  };
}

// iOS scrolls the document to the top on a status-bar tap. The window rests 1px down, so the tap
// shows up as a scroll to 0. Only a scroll to 0 from rest counts: a finger dragging, the keyboard
// moving the page or a sheet pinning the body take the window to 0 too.
export function watchStatusBarTap(
  win: Window,
  { onTap, isLocked }: StatusBarTapOptions,
): () => void {
  let resting = false;
  let touching = false;
  // A window that couldn't reach 1 isn't asked again from its own scroll event, which would loop.
  let stuck = false;
  let settlesAt = 0;
  const rest = () => {
    win.scrollTo(0, RESTING_Y);
    resting = win.scrollY === RESTING_Y;
    stuck = !resting;
  };
  const changed = () => {
    settlesAt = Date.now() + SETTLE_MS;
    stuck = false;
  };
  const onTouch = (event: Event) => {
    touching = (event as TouchEvent).touches.length > 0;
    if (touching) return;
    changed();
    if (win.scrollY === 0 && !isLocked()) rest();
  };
  const onScroll = () => {
    if (isLocked()) return;
    if (touching || win.scrollY !== 0) {
      resting = !touching && win.scrollY === RESTING_Y;
      return;
    }
    if (resting && Date.now() >= settlesAt) onTap();
    if (!stuck) rest();
  };
  const unlisten = listen(win, onTouch, changed);
  win.addEventListener('scroll', onScroll, { passive: true });
  if (!isLocked()) rest();
  return () => {
    unlisten();
    win.removeEventListener('scroll', onScroll);
  };
}
