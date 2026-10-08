export interface Span {
  left: number;
  right: number;
}

const middle = (span: Span): number => (span.left + span.right) / 2;

/** The phone board's page: the column whose middle is nearest the middle of the visible board. */
export function currentPage(columns: readonly Span[], view: Span): number {
  let page = 0;
  let best = Infinity;
  for (const [index, column] of columns.entries()) {
    const distance = Math.abs(middle(column) - middle(view));
    if (distance < best) {
      page = index;
      best = distance;
    }
  }
  return page;
}

/** How far to scroll sideways so `item` shows in full; its start wins when it can't fit. */
export function revealDistance(item: Span, view: Span): number {
  if (item.left < view.left) return item.left - view.left;
  if (item.right > view.right) return Math.min(item.right - view.right, item.left - view.left);
  return 0;
}

export const spanOf = (element: Element): Span => {
  const { left, right } = element.getBoundingClientRect();
  return { left, right };
};

export const columnElements = (board: HTMLElement): HTMLElement[] =>
  Array.from(board.querySelectorAll<HTMLElement>('[data-drop-group]'));

/** Which column the board shows now, measured from the screen. */
export const measurePage = (board: HTMLElement): number =>
  currentPage(columnElements(board).map(spanOf), spanOf(board));
