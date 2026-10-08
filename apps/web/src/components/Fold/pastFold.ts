// Something Tab reaches under the fold would have focus where nobody can see it, so the fold
// opens for it.
export const pastFold = (target: Element, box: Element): boolean =>
  target.getBoundingClientRect().bottom > box.getBoundingClientRect().bottom;
