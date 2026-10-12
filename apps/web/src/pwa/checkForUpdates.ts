export const UPDATE_CHECK_MS = 30 * 60 * 1000;

interface Updatable {
  update(): Promise<unknown>;
}

// Browsers look for a new sw.js only on page loads, which an app left open never makes.
export function checkForUpdates(registration: Updatable): () => void {
  // Not skipped while navigator.onLine is false: WebKit has kept it false for 20 minutes while every
  // request was answered (PT-179). A failed check is harmless and the next one retries.
  const check = () => {
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
