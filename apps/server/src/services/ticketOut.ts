import type { Ticket } from '@tracker/shared';
import type { Db, TicketRow } from '../db/schema';
import { labelIdsOfTicket } from '../repositories/ticketLabels';
import { toTicket } from './mappers';

// A ticket as the API answers it, with its labels, which live in a table of their own.
export const ticketOut = async (db: Db, row: TicketRow, projectKey: string): Promise<Ticket> =>
  toTicket(row, projectKey, await labelIdsOfTicket(db, row.id));
