export const REORDER_ROW_ATTRIBUTE = 'data-reorder-row';
// A row with it moves at once; its lift, shadow and background still animate (Sidebar.module.css).
const STILL_ATTRIBUTE = 'data-still';

export type RowElements = Map<string, HTMLElement>;

export function rowsIn(list: HTMLElement | null): RowElements {
  const rows: RowElements = new Map();
  if (!list) return rows;
  for (const row of list.querySelectorAll<HTMLElement>(`[${REORDER_ROW_ATTRIBUTE}]`)) {
    rows.set(row.getAttribute(REORDER_ROW_ATTRIBUTE) ?? '', row);
  }

  return rows;
}

export const moveRow = (row: HTMLElement | undefined, offset: number): void => {
  if (row) row.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : '';
};

// Where each row is on screen now, its drag offset included.
export const shownTops = (rows: RowElements): Map<string, number> =>
  new Map([...rows].map(([id, row]) => [id, row.getBoundingClientRect().top]));

// Reading layout makes the browser apply the styles written so far, so a later change of the same
// property starts a transition from them instead of replacing them unseen.
const applyStyles = (rows: RowElements): void => {
  rows.values().next().value?.getBoundingClientRect();
};

// Each row starts where it was shown and glides into its new place: the rows lose their offsets,
// are read once, take the offset back from where they were shown, and then glide to none.
export function settleRows(rows: RowElements, shown: ReadonlyMap<string, number>, glide: boolean) {
  for (const row of rows.values()) {
    row.setAttribute(STILL_ATTRIBUTE, '');
    moveRow(row, 0);
  }

  applyStyles(rows);
  const moved = glide
    ? [...rows].flatMap(([id, row]) => {
        const offset = (shown.get(id) ?? 0) - row.getBoundingClientRect().top;

        return Math.abs(offset) < 0.5 ? [] : [{ row, offset }];
      })
    : [];
  for (const { row, offset } of moved) moveRow(row, offset);
  applyStyles(rows);
  for (const row of rows.values()) row.removeAttribute(STILL_ATTRIBUTE);
  for (const { row } of moved) moveRow(row, 0);
}
