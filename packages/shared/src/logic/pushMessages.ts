import { PUSH_BODY_MAX, PUSH_TITLE_MAX, type PushMessage } from '../domain/push';
import { formatTicketKey } from './ticketKey';

// By code point, so a cut never leaves half an emoji.
function cut(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  return chars.length <= max
    ? flat
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

const message = (title: string, body: string, url: string, tag: string): PushMessage => ({
  title: cut(title, PUSH_TITLE_MAX),
  body: cut(body, PUSH_BODY_MAX),
  url,
  tag,
});

export const ticketPath = (projectKey: string, num: number): string =>
  `/p/${encodeURIComponent(projectKey)}/${num}`;

export const chatPath = (projectKey: string, chatId: string): string =>
  `/p/${encodeURIComponent(projectKey)}/ask/${encodeURIComponent(chatId)}`;

export interface PushTicket {
  projectKey: string;
  num: number;
  title: string;
}

// One tag per ticket, so "ready for you" replaces "Claude finished" on the lock screen.
const ticketTag = (ticket: PushTicket) =>
  `ticket:${formatTicketKey(ticket.projectKey, ticket.num)}`;

export function runEndedPush(ticket: PushTicket, error: string | null): PushMessage {
  const key = formatTicketKey(ticket.projectKey, ticket.num);
  const title = error === null ? `${key}: Claude finished` : `${key}: Claude stopped: ${error}`;
  return message(title, ticket.title, ticketPath(ticket.projectKey, ticket.num), ticketTag(ticket));
}

export function reviewedPush(ticket: PushTicket, rating: number): PushMessage {
  const key = formatTicketKey(ticket.projectKey, ticket.num);
  const title = `${key} is ready for you · ${rating}/5`;
  return message(title, ticket.title, ticketPath(ticket.projectKey, ticket.num), ticketTag(ticket));
}

export interface PushChat {
  projectKey: string;
  chatId: string;
  title: string;
}

export function chatAnsweredPush(chat: PushChat, answer: string): PushMessage {
  const title = chat.title.trim() ? `Claude answered: ${chat.title}` : 'Claude answered';
  return message(title, answer, chatPath(chat.projectKey, chat.chatId), `chat:${chat.chatId}`);
}
