import { reloadWhenSafe } from './reloadWhenSafe';

export const CHUNK_RELOAD_KEY = 'tracker.chunkReloadAt';
// Long enough for the reloaded page to load and fail again; a later failure can be a newer build.
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

// In the tab's session, so the reloaded page knows a reload was already tried.
function rememberReload(now: number): boolean {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

// Without storage a reload can't be remembered, so none is tried: it could repeat forever.
function reloadedRecently(now: number): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY));
    return now - at < CHUNK_RELOAD_WINDOW_MS;
  } catch {
    return true;
  }
}

// A new build replaces the old one's chunks, so a page still on the old build can't load a lazy
// chunk it hasn't loaded yet. A reload brings the new build; like an update it waits until no
// typed text would be lost. When the reloaded page fails too, the file is missing for another
// reason, and reloading again would only loop. The failed import still fails, so the screen shows
// its error meanwhile.
export function reloadOnPreloadError(reload: () => void): () => void {
  let handled = false;
  const onPreloadError = (event: VitePreloadErrorEvent) => {
    if (handled) return;
    handled = true;
    if (reloadedRecently(Date.now())) {
      console.warn('A file of the app still fails to load after a reload; staying.', event.payload);
      return;
    }
    reloadWhenSafe(() => {
      if (rememberReload(Date.now())) reload();
    });
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}
