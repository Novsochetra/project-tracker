import { reloadWhenSafe } from './reloadWhenSafe';

// A new build replaces the old one's chunks, so a page still on the old build can't load a lazy
// chunk it hasn't loaded yet. A reload brings the new build; like an update it waits until no
// typed text would be lost. The failed import still fails, so the screen shows its error meanwhile.
export function reloadOnPreloadError(reload: () => void): () => void {
  let waiting = false;
  const onPreloadError = () => {
    if (waiting) return;
    waiting = true;
    reloadWhenSafe(reload);
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}
