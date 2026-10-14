import type { AskOptions } from './askOptions';
import type { Attachment } from './attachment';
import type { ChatContext } from './chatContext';
import type { Run } from './run';
import type { RunTodo } from './runStep';
import type { RunUsage } from './runUsage';

export const CHAT_ROLES = ['person', 'claude'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const CHAT_QUESTION_MAX = 10_000;
// The helper cuts a longer answer to fit rather than lose it.
export const CHAT_ANSWER_MAX = 100_000;
export const CHAT_TITLE_MAX = 80;
export const CHAT_NO_ANSWER = 'Claude Code gave no answer.';

// Pictures Claude shows in one answer (PT-225), each named by an image card.
export const CHAT_ANSWER_IMAGES_MAX = 10;
// Only types the tracker always strips of their metadata, so no picture carries where it was taken.
export const CHAT_ANSWER_IMAGE_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

export interface ChatTicket {
  key: string;
  title: string;
}

export interface CardTicketLink {
  index: number;
  ticketKey: string;
}

export interface Chat {
  id: string;
  projectKey: string;
  title: string;
  // The ticket the chat is about (PT-184), in the chat's project; null once it is deleted.
  ticket: ChatTicket | null;
  // The last question's choice, so the next one starts with it.
  options: AskOptions;
  // So the chat list can say Claude waits for the person there (PT-165).
  waiting: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: ChatRole;
  text: string;
  // The tickets made from this message's cards, by card index, once the person taps Create.
  cardTickets: CardTicketLink[];
  // The run that gave Claude's answer, so its steps can fold under it; null on the person's.
  runId: string | null;
  // The batch this message's Run all card started, once the person taps Confirm.
  batchRunId: string | null;
  // The steps its open list shows, so an older answer can say "23 steps" before they are read:
  // the run's, less Claude's last words when they are the answer itself. 0 on the person's.
  stepCount: number;
  // Claude's last to-do list in the run, kept under the answer; left out when it wrote none.
  todos?: RunTodo[];
  // The files the person sent with a question, or the pictures Claude showed in its answer.
  attachments: Attachment[];
  // What the answer's run took; null on the person's and on answers from older helpers.
  usage: RunUsage | null;
  createdAt: number;
}

export interface ChatDetail {
  chat: Chat;
  messages: ChatMessage[];
  // The latest ask in this chat, so the screen can show Claude thinking or why it stopped.
  run: Run | null;
  // The questions that failed or were stopped after Claude took steps, oldest first. They add no
  // message, so this is how what Claude did keeps its place in the thread.
  stoppedRuns: Run[];
  // Left out until an answer comes from a helper that sends it (PT-239), so older chats show none.
  context?: ChatContext;
}

// Tells the person's other tabs and devices to leave a chat deleted elsewhere (PT-159).
export interface ChatDeletedEvent {
  type: 'chat-deleted';
  chatId: string;
  projectId: string;
}
