import type { Status, TicketListItem, TicketsAcrossProjects } from '@tracker/shared';
import { entriesOf, isEntry, isList } from '../../lib/entries';

const sameKey = (a: unknown, b: string): boolean =>
  typeof a === 'string' && a.toUpperCase() === b.toUpperCase();

const movesAway = (ticket: unknown, ticketKey: string, statusId: string): boolean => {
  if (!isEntry(ticket)) return false;
  const { key, statusId: now } = ticket as Partial<TicketListItem>;
  return sameKey(key, ticketKey) && now !== statusId;
};

// Moving to a second reviewed status is rare; the refetch once the move is saved puts it back.
// A list or entry this app can't read ({ tickets: null }, a null ticket) stays as it came, so the
// move still goes out.
export function withoutMovedTicket(
  list: TicketsAcrossProjects,
  ticketKey: string,
  statusId: string | undefined,
): TicketsAcrossProjects {
  if (statusId === undefined || !isEntry(list) || !isList(list.tickets)) return list;
  const tickets = list.tickets.filter((ticket) => !movesAway(ticket, ticketKey, statusId));
  return tickets.length === list.tickets.length ? list : { ...list, tickets };
}

export const readyStatuses = (list: TicketsAcrossProjects | undefined): Status[] =>
  isEntry(list) ? entriesOf(list.statuses) : [];

// The service worker keeps answers for a week, so offline it can still hand over a list saved
// before the statuses came with it: its rows show without Done until the tracker answers.
export const withStatuses = (
  answer: TicketsAcrossProjects | TicketListItem[],
): TicketsAcrossProjects => (Array.isArray(answer) ? { tickets: answer, statuses: [] } : answer);
