export interface RowSpan {
  // From the top of the card's content.
  top: number;
  height: number;
}

// Ending 30–70% into a row, the card shows a row cut off, so the list reads as going on. Ending near
// a row line, or with a row nearly whole, it looked complete until scrolled (PT-117).
const PEEK_LEAST = 0.3;
const PEEK_MOST = 0.7;

// The card already has all the height there is, so one ending near the top of a row can't reach
// that row's middle and is cut back to the middle of the row above (PT-129).
export function peekHeight(available: number, rows: readonly RowSpan[]): number | null {
  const end = rows.findIndex((row) => row.top + row.height > available + 0.5);
  const row = rows[end];
  if (!row) return null;
  const shown = (available - row.top) / row.height;
  if (shown >= PEEK_LEAST && shown <= PEEK_MOST) return null;
  const target = shown > PEEK_MOST ? row : rows[end - 1];
  return target ? target.top + target.height / 2 : null;
}
