export const UPDATE_CHECK_MS = 30 * 60 * 1000;

interface Updatable {
  update(): Promise<unknown>;
}

// Browsers look for a new sw.js only on page loads, which an app left open never makes.
export function checkForUpdates(registration: Updatable): () => void {
  const check = () => {
    if (!navigator.onLine) return;
    // The server can still be unreachable; a failed check is harmless and the next one retries.
    registration.update().catch(() => undefined);
  };
  const checkWhenVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  const timer = window.setInterval(check, UPDATE_CHECK_MS);
  document.addEventListener('visibilitychange', checkWhenVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', checkWhenVisible);
  };
}
