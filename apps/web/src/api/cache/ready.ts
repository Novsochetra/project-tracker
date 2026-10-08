import type { TicketListItem, TicketsAcrossProjects } from '@tracker/shared';

const sameKey = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

// Moving to a second reviewed status is rare; the refetch once the move is saved puts it back.
export function withoutMovedTicket(
  list: TicketsAcrossProjects,
  ticketKey: string,
  statusId: string | undefined,
): TicketsAcrossProjects {
  if (statusId === undefined) return list;
  const tickets = list.tickets.filter(
    (ticket) => !sameKey(ticket.key, ticketKey) || ticket.statusId === statusId,
  );
  return tickets.length === list.tickets.length ? list : { ...list, tickets };
}

// The service worker keeps answers for a week, so offline it can still hand over a list saved
// before the statuses came with it: its rows show without Done until the tracker answers.
export const withStatuses = (
  answer: TicketsAcrossProjects | TicketListItem[],
): TicketsAcrossProjects => (Array.isArray(answer) ? { tickets: answer, statuses: [] } : answer);
