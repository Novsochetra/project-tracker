// The share of the screen the reader scrolls down before the jump shows: the first screen, where
// the title, the details and the start of the description sit, stays uncovered.
export const SCROLLED_DOWN_SHARE = 0.25;

export const isScrolledDown = (scrollTop: number, screenHeight: number): boolean =>
  scrollTop > screenHeight * SCROLLED_DOWN_SHARE;
