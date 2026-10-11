// The browser says nothing when a reload it was asked for stops (its Stop button), so after this
// long the reload no longer counts as on its way. A page's document is one small file, quicker
// than a screen's code, and the slowest screen code that loaded, a few files on slow 3G, took
// about 5 s (PT-104).
export const RELOAD_ON_ITS_WAY_MS = 5_000;

let onItsWayUntil = 0;

// The page keeps running between asking for a reload and unloading. A push meanwhile adds a
// history entry that the reload then fills with the screen on show, so the history holds it twice
// (PT-108, PT-119). Timed rather than marked for good: the reload may never come, and pushes after
// that must still go.
export function reloadPage(reload: () => void): void {
  onItsWayUntil = performance.now() + RELOAD_ON_ITS_WAY_MS;
  reload();
}

export const reloadTimeLeft = (): number => Math.max(0, onItsWayUntil - performance.now());

// Chromium cancels a reload for a Back or Forward that comes before the new page. WebKit still
// finishes it but runs this too, so a tap meanwhile shows its screen until the new page comes.
export function forgetReload(): void {
  onItsWayUntil = 0;
}
