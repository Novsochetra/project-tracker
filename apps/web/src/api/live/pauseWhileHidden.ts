// Two pings: a quick look at another app keeps the stream instead of paying for a full refresh.
export const HIDDEN_GRACE_MS = 30_000;

export interface Pausable {
  pause: () => void;
  resume: () => void;
}

const isHidden = (): boolean => document.visibilityState === 'hidden';

// Every ping wakes a phone's radio, and a hidden page shows nothing that live updates would change.
export function pauseWhileHidden(target: Pausable): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;

  const pause = () => {
    // A phone that suspended the page can run this overdue timer just before the visible event.
    if (!isHidden()) return;
    paused = true;
    target.pause();
  };
  const onVisibilityChange = () => {
    clearTimeout(timer);
    if (isHidden()) {
      timer = setTimeout(pause, HIDDEN_GRACE_MS);
    } else if (paused) {
      paused = false;
      target.resume();
    }
  };

  onVisibilityChange();
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
