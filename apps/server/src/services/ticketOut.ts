import type { Ticket } from '@tracker/shared';
import type { Db, TicketRow } from '../db/schema';
import { labelIdsOfTicket } from '../repositories/ticketLabels';
import { toTicket } from './mappers';

export const ticketOut = async (db: Db, row: TicketRow, projectKey: string): Promise<Ticket> =>
  toTicket(row, projectKey, await labelIdsOfTicket(db, row.id));
