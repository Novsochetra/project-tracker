import {
  CHAT_TITLE_MAX,
  formatTicketKey,
  isAnswerStep,
  type CardTicketLink,
  type Chat,
  type ChatMessage,
  type ChatTicket,
  type QueuedMessage,
} from '@tracker/shared';
import type { AttachmentRow } from '../db/schema';
import type { CardTicketRow } from '../repositories/chatCardTickets';
import type { QueuedRow } from '../repositories/chatQueue';
import type { ChatWithKey, MessageWithSteps } from '../repositories/chats';
import { toAttachment } from './mappers';
import { usageOfRow } from './runUsage';

// A chat's ticket is one of its own project's, so the project's key makes the ticket's.
const chatTicket = (row: ChatWithKey): ChatTicket | null =>
  row.ticketNum === null
    ? null
    : { key: formatTicketKey(row.projectKey, row.ticketNum), title: row.ticketTitle ?? '' };

export const toChat = (row: ChatWithKey): Chat => ({
  id: row.id,
  projectKey: row.projectKey,
  title: row.title,
  ticket: chatTicket(row),
  options: { model: row.askModel, mode: row.askMode, effort: row.askEffort },
  // SQLite answers exists() with 0 or 1, Postgres with a boolean.
  waiting: Boolean(row.waiting),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// The count above an answer is what its open list shows, which leaves out Claude's last words
// when they are the answer itself.
function shownStepCount(row: MessageWithSteps): number {
  const count = row.stepCount ?? 0;
  if (row.lastStepKind === null || row.lastStepLabel === null) return count;
  const last = {
    kind: row.lastStepKind,
    label: row.lastStepLabel,
    subAgent: row.lastStepSubAgent === 1,
  };
  return isAnswerStep(last, row.text) ? count - 1 : count;
}

export const toCardTicket = (row: CardTicketRow): CardTicketLink => ({
  index: row.cardIndex,
  ticketKey: formatTicketKey(row.projectKey, row.ticketNum),
});

export const toMessage = (
  row: MessageWithSteps,
  cards: readonly CardTicketRow[],
  files: readonly AttachmentRow[],
): ChatMessage => ({
  id: row.id,
  chatId: row.chatId,
  role: row.role,
  text: row.text,
  cardTickets: cards.filter((card) => card.messageId === row.id).map(toCardTicket),
  runId: row.runId,
  batchRunId: row.batchRunId,
  stepCount: shownStepCount(row),
  attachments: files.map(toAttachment),
  usage: usageOfRow(row),
  createdAt: row.createdAt,
});

export const toQueuedMessage = (
  row: QueuedRow,
  files: readonly AttachmentRow[],
): QueuedMessage => ({
  id: row.messageId,
  text: row.text,
  attachments: files.map(toAttachment),
  options: { model: row.askModel, mode: row.askMode, effort: row.askEffort },
  createdAt: row.createdAt,
});

// The first question names the chat in the list, on one line.
export function chatTitle(question: string): string {
  const line = question.replace(/\s+/g, ' ').trim();
  return line.length <= CHAT_TITLE_MAX ? line : `${line.slice(0, CHAT_TITLE_MAX - 1).trimEnd()}…`;
}
