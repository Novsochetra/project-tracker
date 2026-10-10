import type { ChatRole } from '../domain/chat';

export interface AskPromptInput {
  project: { key: string; name: string };
  question: string;
  // Earlier messages, for a helper that can't resume the chat's Claude Code session.
  history: readonly { role: ChatRole; text: string }[];
}

const CARD_EXAMPLE = [
  '````ticket',
  'title: <short title>',
  'priority: high | medium | low',
  '---',
  '<description in Markdown: ## Why, ## Steps, ## Done when>',
  '````',
].join('\n');

const rules = (project: AskPromptInput['project']) =>
  [
    `The person who owns the project "${project.name}" (${project.key}) asks you this from the project tracker on their phone.`,
    "You are in the project's folder in read-only mode: read and search the code, never change files, never run commands that change things.",
    'Answer plainly and briefly. They read it on a phone.',
    `Only when they ask for a ticket, or to change the ticket you drafted, end your answer with one ticket card exactly like this (four backticks):\n\n${CARD_EXAMPLE}`,
    "You can't create tickets or start work. They tap Create and then Run on the card.",
  ].join('\n');

const SPEAKERS: Record<ChatRole, string> = { person: 'Person', claude: 'You' };

const transcript = (history: AskPromptInput['history']) =>
  history.map((message) => `${SPEAKERS[message.role]}:\n${message.text}`).join('\n\n');

export function buildAskPrompt({ project, question, history }: AskPromptInput): string {
  const parts = [rules(project)];
  if (history.length > 0) parts.push(`Earlier in this chat:\n\n${transcript(history)}`);
  parts.push(`Question:\n${question}`);
  return parts.join('\n\n---\n\n');
}
