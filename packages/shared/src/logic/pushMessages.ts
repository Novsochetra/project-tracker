import { PUSH_BODY_MAX, PUSH_TITLE_MAX, type PushMessage } from '../domain/push';
import { formatTicketKey } from './ticketKey';

// By code point, so a cut never leaves half an emoji.
export function cutPushText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = [...flat];

  return chars.length <= max
    ? flat
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

export const pushMessage = (
  title: string,
  body: string,
  url: string,
  tag: string,
): PushMessage => ({
  title: cutPushText(title, PUSH_TITLE_MAX),
  body: cutPushText(body, PUSH_BODY_MAX),
  url,
  tag,
});

export const ticketPath = (projectKey: string, num: number): string =>
  `/p/${encodeURIComponent(projectKey)}/${num}`;

export interface PushTicket {
  projectKey: string;
  num: number;
  title: string;
}

// One tag per ticket, so a newer push about it replaces the older one on the lock screen.
const ticketTag = (ticket: PushTicket) =>
  `ticket:${formatTicketKey(ticket.projectKey, ticket.num)}`;

export const ticketMessage = (title: string, ticket: PushTicket, body = ticket.title) =>
  pushMessage(title, body, ticketPath(ticket.projectKey, ticket.num), ticketTag(ticket));

// A lock screen shows a push without unlocking, and an agent's question can hold command output
// or secrets, so a ticket push never holds it.
export const openedLine = (ticket: PushTicket, line: string) => `${ticket.title} · ${line}`;

export function reviewedPush(ticket: PushTicket, rating: number): PushMessage {
  const key = formatTicketKey(ticket.projectKey, ticket.num);
  const title = `${key} is ready for you · ${rating}/5`;

  return ticketMessage(title, ticket);
}

export function questionPush({ ticket }: { ticket: PushTicket }): PushMessage {
  const key = formatTicketKey(ticket.projectKey, ticket.num);

  return ticketMessage(
    `${key}: An agent has a question`,
    ticket,
    openedLine(ticket, 'Open the ticket to answer.'),
  );
}
