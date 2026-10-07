let openRow: { token: symbol; close: () => void } | null = null;

export function closeOtherRows(token: symbol): void {
  if (!openRow || openRow.token === token) return;
  const { close } = openRow;
  openRow = null;
  close();
}

export function markRowOpen(token: symbol, close: () => void): void {
  closeOtherRows(token);
  openRow = { token, close };
}

export function markRowClosed(token: symbol): void {
  if (openRow?.token === token) openRow = null;
}
