let reloading = false;

// The page keeps running between asking for a reload and unloading, and a push meanwhile adds a
// history entry that the reload then fills with the screen on show (PT-108), so navigation asks
// this first.
export function reloadPage(reload: () => void): void {
  reloading = true;
  reload();
}

export const isPageReloading = (): boolean => reloading;
