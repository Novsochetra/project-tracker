let asked = 0;

// The page keeps running between asking for a reload and unloading, and a push that waited
// meanwhile for its screen's code (code that failed and asked for the reload) would add a history
// entry that the reload then fills with the screen on show (PT-108). Counted rather than marked
// for good: the reload may never come, as Chromium cancels it for a Back that comes first, and
// pushes after that must still go.
export function reloadPage(reload: () => void): void {
  asked += 1;
  reload();
}

export const reloadsAsked = (): number => asked;
