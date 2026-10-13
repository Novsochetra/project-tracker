import type { AskMode } from '../domain/askOptions';
import type { ChatRole } from '../domain/chat';
import { ticketBlock, type PromptTicket } from './prompt';

export interface AskPromptInput {
  project: { key: string; name: string };
  mode: AskMode;
  question: string;
  // Earlier messages, for a helper that can't resume the chat's Claude Code session.
  history: readonly { role: ChatRole; text: string }[];
  // The ticket the chat is about, read again for each question so it is never stale.
  ticket?: PromptTicket | null;
}

const CARD_EXAMPLE = [
  '````ticket',
  'title: <short title>',
  'priority: high | medium | low',
  '---',
  '<description in Markdown: ## Why, ## Steps, ## Done when>',
  '````',
].join('\n');

const READ_ONLY =
  "You are in the project's folder in read-only mode: read and search the code, never change files, never run commands that change things.";
const NO_WORK = "You can't create tickets or start work. They tap Create and then Run on the card.";

const MODE_RULES: Record<AskMode, { folder: string; last: readonly string[] }> = {
  ask: { folder: READ_ONLY, last: [NO_WORK] },
  plan: {
    folder: READ_ONLY,
    last: [
      'Make a plan for what they ask: the steps, the files and the risks. Change nothing yet.',
      NO_WORK,
    ],
  },
  edit: {
    folder:
      "You are in the project's folder and may change files, run commands and use the tracker tools to do what they ask.",
    last: [
      'When you work on tickets, follow the tracker workflow: claim each ticket, do the work, then submit it for review. Never move a ticket to Done.',
      'When you finish, say briefly what you did.',
    ],
  },
};

const rules = (project: AskPromptInput['project'], mode: AskMode) =>
  [
    `The person who owns the project "${project.name}" (${project.key}) asks you this from the project tracker on their phone.`,
    MODE_RULES[mode].folder,
    'Answer plainly and briefly. They read it on a phone.',
    `Only when they ask for a ticket, or to change the ticket you drafted, end your answer with one ticket card exactly like this (four backticks):\n\n${CARD_EXAMPLE}`,
    ...MODE_RULES[mode].last,
  ].join('\n');

const SPEAKERS: Record<ChatRole, string> = { person: 'Person', claude: 'You' };

const transcript = (history: AskPromptInput['history']) =>
  history.map((message) => `${SPEAKERS[message.role]}:\n${message.text}`).join('\n\n');

export function buildAskPrompt({
  project,
  mode,
  question,
  history,
  ticket,
}: AskPromptInput): string {
  const parts = [rules(project, mode)];
  if (ticket) parts.push(`This chat is about this ticket:\n\n${ticketBlock(ticket, '##')}`);
  if (history.length > 0) parts.push(`Earlier in this chat:\n\n${transcript(history)}`);
  parts.push(`Question:\n${question}`);
  return parts.join('\n\n---\n\n');
}
