export const LAST_HELPER_STORAGE_KEY = 'tracker.lastHelper';

export function readLastHelper(): string | null {
  try {
    return window.localStorage.getItem(LAST_HELPER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberHelper(helperId: string): void {
  try {
    window.localStorage.setItem(LAST_HELPER_STORAGE_KEY, helperId);
  } catch {
    // Without storage the sheet picks the first helper, as on a new device.
  }
}
