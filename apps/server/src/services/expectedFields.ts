import type { expectedFields } from '@tracker/shared';
import type { z } from 'zod';
import type { TicketRow } from '../db/schema';
import { staleEdit } from '../errors';
import type { TicketMatch } from '../repositories/tickets';
import type { FieldInput } from './ticketChanges';

export type ExpectedValues = z.output<typeof expectedFields>;

const CHECKED = ['title', 'description', 'assignee'] as const;

// The values the edit was typed over, for the fields it names. A field with other text now means a
// newer save landed first, so the edit is refused, also when it would change nothing: a tab that
// cleared a name another tab was still sending must not let that older save land after it. The
// write matches them too: on Postgres with several connections, a save committed after this read
// would otherwise be overwritten.
export function expectedMatch(
  ticket: TicketRow,
  input: FieldInput,
  expected: ExpectedValues | undefined,
): TicketMatch {
  const match: TicketMatch = {};
  for (const field of CHECKED) {
    const value = expected?.[field];
    if (value === undefined || input[field] === undefined) continue;
    if (ticket[field] !== value) throw staleEdit();
    match[field] = value;
  }
  return match;
}
