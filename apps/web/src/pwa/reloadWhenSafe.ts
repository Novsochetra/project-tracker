import { isSafeToReload } from './reloadPolicy';

const RECHECK_MS = 1000;

export function reloadWhenSafe(reload: () => void): void {
  const tryReload = () => {
    if (!isSafeToReload(document)) return;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', tryReload);
    reload();
  };
  // Closing a sheet, clearing a draft or finishing a write fires no event here, so poll as well.
  const timer = window.setInterval(tryReload, RECHECK_MS);
  document.addEventListener('visibilitychange', tryReload);
  tryReload();
}
