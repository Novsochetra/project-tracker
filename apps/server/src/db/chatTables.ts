import type { AskEffort, AskMode, AskModel, ChatRole } from '@tracker/shared';

export interface ChatRow {
  id: string;
  userId: string | null;
  projectId: string;
  title: string;
  // Claude Code's session lives on one computer, so it is kept with the helper that made it.
  sessionId: string | null;
  sessionRunnerId: string | null;
  askModel: AskModel;
  askMode: AskMode;
  askEffort: AskEffort;
  // The ticket it was started from; null once that ticket is deleted.
  ticketId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessageRow {
  id: string;
  chatId: string;
  role: ChatRole;
  text: string;
  // Before cards had their own links (chat_card_tickets, 0021); kept for the release before.
  ticketId: string | null;
  // The ask run that answered, on Claude's messages; null on the person's and older ones.
  runId: string | null;
  // The batch its Run all card started, so the card can't start another.
  batchRunId: string | null;
  createdAt: number;
}

export interface ChatCardTicketRow {
  messageId: string;
  cardIndex: number;
  ticketId: string;
}

export interface ChatTables {
  chats: ChatRow;
  chatMessages: ChatMessageRow;
  chatCardTickets: ChatCardTicketRow;
}
