import {
  CHAT_TITLE_MAX,
  formatTicketKey,
  isAnswerStep,
  type Chat,
  type ChatMessage,
} from '@tracker/shared';
import type { ChatWithKey, MessageWithKey } from '../repositories/chats';

export const toChat = (row: ChatWithKey): Chat => ({
  id: row.id,
  projectKey: row.projectKey,
  title: row.title,
  options: { model: row.askModel, mode: row.askMode },
  // SQLite answers exists() with 0 or 1, Postgres with a boolean.
  waiting: Boolean(row.waiting),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// The count above an answer is what its open list shows, which leaves out Claude's last words
// when they are the answer itself.
function shownStepCount(row: MessageWithKey): number {
  const count = row.stepCount ?? 0;
  if (row.lastStepKind === null || row.lastStepLabel === null) return count;
  const last = {
    kind: row.lastStepKind,
    label: row.lastStepLabel,
    subAgent: row.lastStepSubAgent === 1,
  };
  return isAnswerStep(last, row.text) ? count - 1 : count;
}

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
  stepCount: shownStepCount(row),
  createdAt: row.createdAt,
});

// The first question names the chat in the list, on one line.
export function chatTitle(question: string): string {
  const line = question.replace(/\s+/g, ' ').trim();
  return line.length <= CHAT_TITLE_MAX ? line : `${line.slice(0, CHAT_TITLE_MAX - 1).trimEnd()}…`;
}
