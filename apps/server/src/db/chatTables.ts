import type { AskMode, AskModel, ChatRole } from '@tracker/shared';

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
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessageRow {
  id: string;
  chatId: string;
  role: ChatRole;
  text: string;
  ticketId: string | null;
  // The ask run that answered, on Claude's messages; null on the person's and older ones.
  runId: string | null;
  createdAt: number;
}

export interface ChatTables {
  chats: ChatRow;
  chatMessages: ChatMessageRow;
}
