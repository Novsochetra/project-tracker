import { byRank, type DropTarget, type Placeable } from '@tracker/shared';

/** Where a ticket was before a status move: enough to put it back with the move API. */
export interface RestorePoint {
  statusId: string;
  rank: number;
  num: number;
  aboveId: string | null;
  belowId: string | null;
}

const othersIn = (tickets: readonly Placeable[], statusId: string, ticketId: string) =>
  tickets.filter((t) => t.statusId === statusId && t.id !== ticketId).sort(byRank);

/**
 * `ticket` is the ticket as it was; the other tickets of its group keep their ranks when it
 * leaves, so `tickets` may already show the move.
 */
export function restorePoint(tickets: readonly Placeable[], ticket: Placeable): RestorePoint {
  const others = othersIn(tickets, ticket.statusId, ticket.id);
  const after = others.findIndex((other) => byRank(other, ticket) > 0);
  const below = after < 0 ? others.length : after;
  return {
    statusId: ticket.statusId,
    rank: ticket.rank,
    num: ticket.num,
    aboveId: others[below - 1]?.id ?? null,
    belowId: others[below]?.id ?? null,
  };
}

/**
 * Back between the same tickets while either is still in the group, so a reorder meanwhile keeps
 * it beside them; otherwise its old rank finds the place.
 */
export function undoTarget(
  tickets: readonly Placeable[],
  ticketId: string,
  point: RestorePoint,
): DropTarget {
  const { statusId, belowId, aboveId } = point;
  const others = othersIn(tickets, statusId, ticketId);
  const has = (id: string | null) => id !== null && others.some((other) => other.id === id);
  if (has(belowId)) return { statusId, beforeId: belowId };
  if (has(aboveId)) return { statusId, afterId: aboveId };
  const next = others.find((other) => byRank(other, { ...point, id: ticketId }) > 0);
  if (next) return { statusId, beforeId: next.id };
  const last = others.at(-1);
  return last ? { statusId, afterId: last.id } : { statusId };
}
