import type { TicketListItem } from '@tracker/shared';

const sameKey = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

// Moving to a second reviewed status is rare; the refetch once the move is saved puts it back.
export function withoutMovedTicket(
  list: TicketListItem[],
  ticketKey: string,
  statusId: string | undefined,
): TicketListItem[] {
  if (statusId === undefined) return list;
  return list.filter((ticket) => !sameKey(ticket.key, ticketKey) || ticket.statusId === statusId);
}
