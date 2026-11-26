import {
  DONE_MOVE_MAX,
  findStatusByCategory,
  STATUS_CATEGORY_LABELS,
  type Status,
  type TicketListItem,
} from '@tracker/shared';
import type { ReadyItem } from './readyItems';

export interface DoneBatch {
  keys: string[];
  // The done status they all go to, or the category's name when their projects name it apart.
  doneName: string;
}

interface Movable {
  key: string;
  doneName: string;
}

// One ticket has a Done of its own on its row.
const SMALLEST_BATCH = 2;

// More than the tracker takes in one request wait for the next tap, which counts them again.
function batchOf(movable: readonly Movable[]): DoneBatch | null {
  const sent = movable.slice(0, DONE_MOVE_MAX);
  if (sent.length < SMALLEST_BATCH) return null;

  const [first, ...others] = new Set(sent.map(({ doneName }) => doneName));

  return {
    keys: sent.map(({ key }) => key),
    doneName: first !== undefined && others.length === 0 ? first : STATUS_CATEGORY_LABELS.done,
  };
}

// A ticket whose project has no done status stays, as it has no Done on its row either.
export const readyBatch = (items: readonly ReadyItem[]): DoneBatch | null =>
  batchOf(
    items.flatMap(({ ticket, doneStatus }) =>
      doneStatus ? [{ key: ticket.key, doneName: doneStatus.name }] : [],
    ),
  );

export function groupBatch(
  status: Status,
  tickets: readonly TicketListItem[],
  statuses: readonly Status[],
): DoneBatch | null {
  const done = findStatusByCategory(statuses, 'done');
  if (status.category !== 'reviewed' || !done) return null;

  return batchOf(tickets.map(({ key }) => ({ key, doneName: done.name })));
}

export const moveAllLabel = ({ keys, doneName }: DoneBatch): string =>
  `Move ${keys.length} to ${doneName}`;

export const moveAllQuestion = ({ keys, doneName }: DoneBatch): string =>
  `Move all ${keys.length} tickets to ${doneName}?`;

export const movedMessage = ({ keys, doneName }: DoneBatch): string =>
  `${keys.length} tickets moved to ${doneName}`;

export const movedBackMessage = ({ keys }: DoneBatch): string =>
  `${keys.length} tickets moved back`;
