import type { ChatCardTicketRow } from '../db/chatTables';
import type { Db } from '../db/schema';

export interface CardTicketRow {
  messageId: string;
  cardIndex: number;
  projectKey: string;
  ticketNum: number;
}

// Two taps at once both get the same ticket by its client id, so the second link adds nothing.
export async function linkCardTicket(db: Db, row: ChatCardTicketRow): Promise<void> {
  await db
    .insertInto('chatCardTickets')
    .values(row)
    .onConflict((conflict) => conflict.columns(['messageId', 'cardIndex']).doNothing())
    .execute();
}

export const listCardTicketRows = (db: Db, chatId: string): Promise<CardTicketRow[]> =>
  db
    .selectFrom('chatCardTickets')
    .innerJoin('chatMessages', 'chatMessages.id', 'chatCardTickets.messageId')
    .innerJoin('tickets', 'tickets.id', 'chatCardTickets.ticketId')
    .innerJoin('projects', 'projects.id', 'tickets.projectId')
    .select(['chatCardTickets.messageId', 'chatCardTickets.cardIndex'])
    .select(['projects.key as projectKey', 'tickets.num as ticketNum'])
    .where('chatMessages.chatId', '=', chatId)
    .orderBy('chatCardTickets.cardIndex')
    .execute();
