import type { AskOptions } from './askOptions';
import type { Run } from './run';

export const CHAT_ROLES = ['person', 'claude'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const CHAT_QUESTION_MAX = 10_000;
// The helper cuts a longer answer to fit rather than lose it.
export const CHAT_ANSWER_MAX = 100_000;
export const CHAT_TITLE_MAX = 80;
export const CHAT_NO_ANSWER = 'Claude Code gave no answer.';

export interface Chat {
  id: string;
  projectKey: string;
  title: string;
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
  // The ticket made from this message's ticket card, once the person taps Create.
  ticketKey: string | null;
  // The run that gave Claude's answer, so its steps can fold under it; null on the person's.
  runId: string | null;
  // The steps its open list shows, so an older answer can say "23 steps" before they are read:
  // the run's, less Claude's last words when they are the answer itself. 0 on the person's.
  stepCount: number;
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
}
