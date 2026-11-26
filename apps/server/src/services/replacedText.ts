import { descriptionReplacedText, titleReplacedText, type Actor } from '@tracker/shared';
import type { TicketRow } from '../db/schema';
import type { TicketChanges } from '../repositories/tickets';
import { eventEntry, type ActivityEntry } from './ticketWrites';

// A person's own text edits log nothing (SPEC §6.2). An agent's keep the text they replace, since
// it is the person's and would be lost for good.
export function replacedTextEvents(
  actor: Actor,
  ticket: TicketRow,
  changes: TicketChanges,
): ActivityEntry[] {
  if (actor.kind !== 'agent') return [];

  const events: ActivityEntry[] = [];
  if (changes.title !== undefined) events.push(eventEntry(titleReplacedText(ticket.title)));
  if (changes.description !== undefined) {
    events.push(eventEntry(descriptionReplacedText(ticket.description, changes.description)));
  }

  return events;
}
