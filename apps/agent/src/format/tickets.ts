import { PRIORITY_LABELS, type Status, type Ticket } from '@tracker/shared';
import { SEP } from './text';

export function formatTicketLine(ticket: Ticket, statusName: string): string {
  const parts = [
    ticket.key,
    statusName,
    PRIORITY_LABELS[ticket.priority],
    ticket.title || 'Untitled',
  ];
  if (ticket.assignee) parts.push(`@${ticket.assignee}`);
  if (ticket.due) parts.push(`due ${ticket.due}`);
  return parts.join(SEP);
}

export function statusNameOf(statuses: readonly Status[], statusId: string): string {
  return statuses.find((status) => status.id === statusId)?.name ?? 'Unknown status';
}

export function formatTicketList(tickets: readonly Ticket[], statuses: readonly Status[]): string {
  if (tickets.length === 0) return 'No tickets found.';
  return tickets
    .map((ticket) => formatTicketLine(ticket, statusNameOf(statuses, ticket.statusId)))
    .join('\n');
}
