export const FOLDED_ROWS = 2;

export interface TileEdges {
  top: number;
  bottom: number;
}

// Where the second row of files ends, from the top of their box, or null while they take two
// rows or fewer.
export function rowsHeight(tiles: readonly TileEdges[], rows = FOLDED_ROWS): number | null {
  const tops = [...new Set(tiles.map((tile) => Math.round(tile.top)))].sort((a, b) => a - b);
  const lastTop = tops[rows - 1];
  if (tops.length <= rows || lastTop === undefined) return null;
  const shown = tiles.filter((tile) => Math.round(tile.top) <= lastTop);
  return Math.round(Math.max(...shown.map((tile) => tile.bottom)));
}

// The Add tile doesn't count: it follows the files, and a folded grid shows an Add files button
// instead, so counting it would fold and unfold the grid by turns.
export function measureRows(box: HTMLElement): number | null {
  const grid = box.firstElementChild;
  if (!grid) return null;
  const top = box.getBoundingClientRect().top;
  const tiles = [...grid.children]
    .filter((tile) => !tile.hasAttribute('data-add-tile'))
    .map((tile) => {
      const rect = tile.getBoundingClientRect();
      return { top: rect.top - top, bottom: rect.bottom - top };
    });
  return rowsHeight(tiles);
}
