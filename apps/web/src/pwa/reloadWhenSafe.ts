import { isSafeToReload } from './reloadPolicy';

const RECHECK_MS = 1000;

export function reloadWhenSafe(reload: () => void): void {
  const tryReload = () => {
    if (!isSafeToReload(document)) return;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', tryReload);
    reload();
  };
  // A sheet closing fires no event to listen for, so check on a timer as well.
  const timer = window.setInterval(tryReload, RECHECK_MS);
  document.addEventListener('visibilitychange', tryReload);
  tryReload();
}
