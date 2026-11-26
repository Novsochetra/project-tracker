import { descriptionReplacedText, titleReplacedText, type Actor } from '@tracker/shared';
import type { TicketRow } from '../db/schema';
import type { TicketChanges, TicketMatch } from '../repositories/tickets';
import { eventEntry, type ActivityEntry } from './ticketWrites';

export interface ReplacedText {
  events: ActivityEntry[];
  match: TicketMatch;
}

// A person's own text edits log nothing (SPEC §6.2). An agent's keep the text they replace, since
// it is the person's and would be lost for good. The write must still find that text: a save the
// person makes meanwhile would otherwise be lost, and the event would keep the wrong text (§2).
export function replacedText(
  actor: Actor,
  ticket: TicketRow,
  changes: TicketChanges,
): ReplacedText {
  const replaced: ReplacedText = { events: [], match: {} };
  if (actor.kind !== 'agent') return replaced;

  if (changes.title !== undefined) {
    replaced.events.push(eventEntry(titleReplacedText(ticket.title)));
    replaced.match.title = ticket.title;
  }

  if (changes.description !== undefined) {
    const text = descriptionReplacedText(ticket.description, changes.description);
    replaced.events.push(eventEntry(text));
    replaced.match.description = ticket.description;
  }

  return replaced;
}
