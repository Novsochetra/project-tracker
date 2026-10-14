import { PUSH_ACTION_MAX, PUSH_BODY_MAX, PUSH_TITLE_MAX, type PushMessage } from '../domain/push';
import { permissionSubject } from './permissionSubject';
import { AUTO_REVIEW_STOPPED } from './reviewChain';
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

export function chainStoppedPush(ticket: PushTicket, reason: string): PushMessage {
  const title = `${formatTicketKey(ticket.projectKey, ticket.num)}: ${AUTO_REVIEW_STOPPED}`;
  return message(title, reason, ticketPath(ticket.projectKey, ticket.num), ticketTag(ticket));
}

export function reviewedPush(ticket: PushTicket, rating: number): PushMessage {
  const key = formatTicketKey(ticket.projectKey, ticket.num);
  const title = `${key} is ready for you · ${rating}/5`;
  return message(title, ticket.title, ticketPath(ticket.projectKey, ticket.num), ticketTag(ticket));
}

export const ACTIVITY_PATH = '/activity';

export interface PushBatch {
  runId: string;
  projectKey: string;
  total: number;
  notDoneKeys: readonly string[];
}

// One push for the whole batch rather than one a ticket, so its keys name what was left.
export function batchEndedPush(batch: PushBatch, error: string | null): PushMessage {
  const done = `${batch.total - batch.notDoneKeys.length} of ${batch.total} done`;
  const ended = error === null ? 'Run all finished' : 'Run all stopped';
  const notDone = batch.notDoneKeys.length
    ? `Not finished: ${batch.notDoneKeys.join(', ')}`
    : 'Every ticket is done.';
  const body = error === null ? notDone : `${notDone} · ${error}`;
  return message(
    `${batch.projectKey}: ${ended}: ${done}`,
    body,
    ACTIVITY_PATH,
    `batch:${batch.runId}`,
  );
}

export interface PushChat {
  projectKey: string;
  chatId: string;
  title: string;
}

// One tag per chat, so the answer replaces "Claude has a question" in the same chat.
const chatTag = (chat: PushChat) => `chat:${chat.chatId}`;

const named = (text: string, chat: PushChat) =>
  chat.title.trim() ? `${text}: ${chat.title}` : text;

export function chatAnsweredPush(chat: PushChat, answer: string): PushMessage {
  const title = named('Claude answered', chat);
  return message(title, answer, chatPath(chat.projectKey, chat.chatId), chatTag(chat));
}

// Where Claude waits: a ticket (its run or ask_person) or a chat (an Edit question).
export type PushPlace = { ticket: PushTicket } | { chat: PushChat };

const keyOf = (ticket: PushTicket) => formatTicketKey(ticket.projectKey, ticket.num);

function placeOf(place: PushPlace): Pick<PushMessage, 'body' | 'url' | 'tag'> {
  if ('ticket' in place) {
    const { ticket } = place;
    const url = ticketPath(ticket.projectKey, ticket.num);
    return { body: ticket.title, url, tag: ticketTag(ticket) };
  }
  const { chat } = place;
  return { body: chat.title, url: chatPath(chat.projectKey, chat.chatId), tag: chatTag(chat) };
}

export function questionPush(place: PushPlace, question: string): PushMessage {
  const { url, tag } = placeOf(place);
  const asks = 'Claude has a question';
  const title = 'ticket' in place ? `${keyOf(place.ticket)}: ${asks}` : named(asks, place.chat);
  return message(title, question, url, tag);
}

// A lock screen shows text as it is, so a bidi override or a zero-width character could make a
// path read as another one; the card on the phone shows them marked.
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu;

function wanted(label: string): string {
  const subject = permissionSubject(label);
  if (!subject) return 'Claude wants your OK';
  return `Claude wants to ${cut(subject.replace(HIDDEN, '\uFFFD'), PUSH_ACTION_MAX)}`;
}

export function permissionPush(place: PushPlace, label: string): PushMessage {
  const { body, url, tag } = placeOf(place);
  const wants = wanted(label);
  const title = 'ticket' in place ? `${keyOf(place.ticket)}: ${wants}` : wants;
  return message(title, body, url, tag);
}
