const ROW = 'data-chat-row';

// The deleted row leaves the list, so keyboard users keep their place on the chat next to it.
export function focusNeighbourRow(chatId: string): void {
  const rows = [...document.querySelectorAll<HTMLElement>(`[${ROW}]`)];
  const index = rows.findIndex((row) => row.getAttribute(ROW) === chatId);
  if (index < 0) return;
  const neighbour = rows[index + 1] ?? rows[index - 1];
  neighbour?.querySelector<HTMLElement>('button')?.focus();
}
