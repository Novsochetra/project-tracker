import { focusBefore } from '../../lib/focusBefore';
import { readyBatch, type DoneBatch } from './doneBatch';
import type { ReadyItem } from './readyItems';

// The card leaves with its last tickets, so focus goes to the projects above it. A card that stays
// keeps focus on its button, or, once no button is left, on the first ticket that stays.
export function focusAfterMoveAll(
  card: Element,
  items: readonly ReadyItem[],
  batch: DoneBatch,
): void {
  const moving = new Set(batch.keys);
  const staying = items.filter(({ ticket }) => !moving.has(ticket.key));
  const [first] = staying;
  if (!first) {
    focusBefore(card);
    return;
  }

  if (readyBatch(staying)) return;

  card.querySelector<HTMLElement>(`[data-ready-row="${first.ticket.key}"] button`)?.focus();
}
