import { PUSH_ACTION_MAX, type PushMessage } from '../domain/push';
import { permissionSubject } from './permissionSubject';
import {
  cutPushText,
  openedLine,
  pushMessage,
  questionPush,
  ticketMessage,
  type PushTicket,
} from './pushMessages';
import { AUTO_REVIEW_STOPPED } from './reviewChain';
import { formatTicketKey } from './ticketKey';

export const chatPath = (projectKey: string, chatId: string): string =>
  `/p/${encodeURIComponent(projectKey)}/ask/${encodeURIComponent(chatId)}`;

export type PushRunEnd = 'done' | 'failed';

const keyOf = (ticket: PushTicket) => formatTicketKey(ticket.projectKey, ticket.num);

// A failed run's error (the end of the helper's stderr) can hold command output or secrets, so a
// ticket push never holds it.
export function runEndedPush(ticket: PushTicket, ended: PushRunEnd): PushMessage {
  if (ended === 'done') return ticketMessage(`${keyOf(ticket)}: Claude finished`, ticket);

  return ticketMessage(
    `${keyOf(ticket)}: Claude stopped`,
    ticket,
    openedLine(ticket, 'Open the ticket to see why.'),
  );
}

export function chainStoppedPush(ticket: PushTicket, reason: string): PushMessage {
  return ticketMessage(`${keyOf(ticket)}: ${AUTO_REVIEW_STOPPED}`, ticket, reason);
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

  return pushMessage(
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
  pushMessage(
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

// Where a run waits: a ticket (its run) or a chat (an Edit question).
export type PushPlace = { ticket: PushTicket } | { chat: PushChat };

export function askedPush(place: PushPlace): PushMessage {
  if ('chat' in place) {
    return chatMessage(named('Claude has a question', place.chat), place.chat, ANSWER_IT);
  }

  return questionPush(place);
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
    openedLine(ticket, 'Open the ticket to approve it.'),
  );
}

// A lock screen shows text as it is, so a bidi override or a zero-width character could make a
// path read as another one; the card on the phone shows them marked.
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu;

function wanted(label: string): string {
  const subject = permissionSubject(label);
  if (!subject) return 'Claude wants your OK';

  return `Claude wants to ${cutPushText(subject.replace(HIDDEN, '�'), PUSH_ACTION_MAX)}`;
}

export function permissionPush(place: PushPlace, label: string): PushMessage {
  const wants = wanted(label);
  if ('chat' in place) return chatMessage(wants, place.chat, place.chat.title.trim() || ANSWER_IT);

  return ticketMessage(`${keyOf(place.ticket)}: ${wants}`, place.ticket);
}
