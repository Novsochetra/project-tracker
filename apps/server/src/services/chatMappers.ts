import { CHAT_TITLE_MAX, formatTicketKey, type Chat, type ChatMessage } from '@tracker/shared';
import type { ChatWithKey, MessageWithKey } from '../repositories/chats';

export const toChat = (row: ChatWithKey): Chat => ({
  id: row.id,
  projectKey: row.projectKey,
  title: row.title,
  options: { model: row.askModel, mode: row.askMode },
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toMessage = (row: MessageWithKey): ChatMessage => ({
  id: row.id,
  chatId: row.chatId,
  role: row.role,
  text: row.text,
  ticketKey:
    row.projectKey === null || row.ticketNum === null
      ? null
      : formatTicketKey(row.projectKey, row.ticketNum),
  runId: row.runId,
  stepCount: row.stepCount ?? 0,
  createdAt: row.createdAt,
});

// The first question names the chat in the list, on one line.
export function chatTitle(question: string): string {
  const line = question.replace(/\s+/g, ' ').trim();
  return line.length <= CHAT_TITLE_MAX ? line : `${line.slice(0, CHAT_TITLE_MAX - 1).trimEnd()}…`;
}
