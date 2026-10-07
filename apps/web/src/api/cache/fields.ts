import type { Ticket, UpdateTicketInput } from '@tracker/shared';

const TICKET_FIELDS = ['title', 'description', 'statusId', 'priority', 'assignee', 'due'] as const;

export function ticketFields(input: UpdateTicketInput): Partial<Ticket> {
  const fields: Partial<Ticket> = {};
  for (const name of TICKET_FIELDS) {
    const value = input[name];
    if (value !== undefined) Object.assign(fields, { [name]: value });
  }
  return fields;
}
