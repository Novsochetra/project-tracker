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

const ticketMessage = (title: string, ticket: PushTicket, body = ticket.title) =>
  message(title, body, ticketPath(ticket.projectKey, ticket.num), ticketTag(ticket));

export type PushRunEnd = 'done' | 'failed';

// A lock screen shows a push without unlocking, and a failed run's error (the end of the helper's
// stderr) or Claude's question can hold command output or secrets, so a ticket push holds neither.
const opened = (ticket: PushTicket, line: string) => `${ticket.title} · ${line}`;

export function runEndedPush(ticket: PushTicket, ended: PushRunEnd): PushMessage {
  const key = formatTicketKey(ticket.projectKey, ticket.num);
  if (ended === 'done') return ticketMessage(`${key}: Claude finished`, ticket);
  return ticketMessage(
    `${key}: Claude stopped`,
    ticket,
    opened(ticket, 'Open the ticket to see why.'),
  );
}

export function chainStoppedPush(ticket: PushTicket, reason: string): PushMessage {
  const title = `${formatTicketKey(ticket.projectKey, ticket.num)}: ${AUTO_REVIEW_STOPPED}`;
  return ticketMessage(title, ticket, reason);
}

export function reviewedPush(ticket: PushTicket, rating: number): PushMessage {
  const key = formatTicketKey(ticket.projectKey, ticket.num);
  const title = `${key} is ready for you · ${rating}/5`;
  return ticketMessage(title, ticket);
}

export const ACTIVITY_PATH = '/activity';

export interface PushBatch {
  runId: string;
  projectKey: string;
  total: number;
  notDoneKeys: readonly string[];
}

// One push for the whole batch rather than one a ticket, so its keys name what was left.
export function batchEndedPush(batch: PushBatch, ended: PushRunEnd): PushMessage {
  const done = `${batch.total - batch.notDoneKeys.length} of ${batch.total} done`;
  const what = ended === 'done' ? 'Run all finished' : 'Run all stopped';
  const body = batch.notDoneKeys.length
    ? `Not finished: ${batch.notDoneKeys.join(', ')}`
    : 'Every ticket is done.';
  return message(
    `${batch.projectKey}: ${what}: ${done}`,
    body,
    ACTIVITY_PATH,
    `batch:${batch.runId}`,
  );
}

export interface PushChat {
  projectKey: string;
  projectName: string;
  chatId: string;
  title: string;
}

const CHAT_TAG = 'chat:';

// One tag per chat, so the answer replaces "Claude has a question" in the same chat.
const chatTag = (chat: PushChat) => `${CHAT_TAG}${chat.chatId}`;

export const chatOfTag = (tag: string): string | null =>
  tag.startsWith(CHAT_TAG) ? tag.slice(CHAT_TAG.length) : null;

const named = (text: string, chat: PushChat) =>
  chat.title.trim() ? `${text}: ${chat.title}` : text;

// A lock screen shows a push without unlocking, and Claude's text in a chat can hold file content,
// commands or secrets, so a chat push says only what happened, in which chat and project.
const chatMessage = (title: string, chat: PushChat, line: string) =>
  message(
    title,
    `${chat.projectName} · ${line}`,
    chatPath(chat.projectKey, chat.chatId),
    chatTag(chat),
  );

const ANSWER_IT = 'Open the chat to answer.';

export const chatAnsweredPush = (chat: PushChat): PushMessage =>
  chatMessage(named('Claude answered', chat), chat, 'Open the chat to read it.');

export const chatFailedPush = (chat: PushChat): PushMessage =>
  chatMessage(named('Claude stopped', chat), chat, 'Open the chat to see why.');

// Where Claude waits: a ticket (its run or ask_person) or a chat (an Edit question).
export type PushPlace = { ticket: PushTicket } | { chat: PushChat };

const keyOf = (ticket: PushTicket) => formatTicketKey(ticket.projectKey, ticket.num);

export function questionPush(place: PushPlace): PushMessage {
  const asks = 'Claude has a question';
  if ('chat' in place) return chatMessage(named(asks, place.chat), place.chat, ANSWER_IT);
  const { ticket } = place;
  return ticketMessage(
    `${keyOf(ticket)}: ${asks}`,
    ticket,
    opened(ticket, 'Open the ticket to answer.'),
  );
}

// The plan's text stays off the lock screen, like a chat's answer.
export function planPush(place: PushPlace): PushMessage {
  const ready = 'Claude has a plan for you';
  if ('chat' in place) {
    return chatMessage(named(ready, place.chat), place.chat, 'Open the chat to approve it.');
  }
  const { ticket } = place;
  return ticketMessage(
    `${keyOf(ticket)}: ${ready}`,
    ticket,
    opened(ticket, 'Open the ticket to approve it.'),
  );
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
  const wants = wanted(label);
  if ('chat' in place) return chatMessage(wants, place.chat, place.chat.title.trim() || ANSWER_IT);
  return ticketMessage(`${keyOf(place.ticket)}: ${wants}`, place.ticket);
}
