export interface RowSpan {
  // From the top of the card's content.
  top: number;
  height: number;
}

// How much of the row a scrolling card ends in shows: about half, so its text is cut and the list
// reads as going on. Ending on a row line, or with a row nearly whole, it looked complete until
// scrolled (PT-117).
const PEEK_LEAST = 0.45;
const PEEK_MOST = 0.55;

// The height to cap a card of rows at so the row it ends in shows about half, or null when the
// rows fit or already end that way. It can only take height away: the card has all there is.
export function peekHeight(available: number, rows: readonly RowSpan[]): number | null {
  const last = rows.at(-1);
  if (!last || last.top + last.height <= available + 0.5) return null;
  let height: number | null = null;
  for (const row of rows) {
    if (row.top + row.height * PEEK_LEAST > available) break;
    height = Math.min(row.top + row.height * PEEK_MOST, available);
  }
  return height === available ? null : height;
}
