import type { AskHistoryMessage } from '@tracker/shared';
import type { Db } from '../db/schema';
import { listCardTicketRows } from '../repositories/chatCardTickets';
import { listMessageRows } from '../repositories/chats';
import { chatFilesByMessage } from './chatFiles';
import { toCardTicket } from './chatMappers';

// So the prompt can say which cards are tickets now, and which files each question had.
export async function askHistory(db: Db, chatId: string): Promise<AskHistoryMessage[]> {
  const cards = await listCardTicketRows(db, chatId);
  const files = await chatFilesByMessage(db, chatId);
  const messages = await listMessageRows(db, chatId);
  return messages.map(({ id, role, text }) => ({
    role,
    text,
    cardTickets: cards.filter((card) => card.messageId === id).map(toCardTicket),
    files: (files.get(id) ?? []).map((file) => file.fileName),
  }));
}
