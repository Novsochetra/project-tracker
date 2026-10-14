import { VERDICT_LABELS, type ReviewVerdict } from '../domain/activity';
import { PRIORITY_LABELS, type Priority } from '../domain/priority';
import { formatShortDay } from './format';
import {
  distinctLabels,
  instructionsBlock,
  type PromptInstructions,
  type PromptLabel,
} from './instructions';
import { ticketSubAgentLines } from './ticketSubAgents';

export interface PromptProject extends PromptInstructions {
  name: string;
  key: string;
  repo: string;
  maxSubAgents?: number;
}

export interface PromptReview {
  verdict: ReviewVerdict;
  rating: number;
  text: string;
}

export interface PromptTicket {
  key: string;
  title: string;
  description: string;
  priority: Priority;
  statusName: string;
  due: string;
  assignee: string;
  notes: readonly string[];
  lastReport: string | null;
  lastReview: PromptReview | null;
  labels?: readonly PromptLabel[];
}

function replyFormat(key: string): string {
  return [
    '```',
    `TICKET: ${key}`,
    'STATUS: done | in progress | blocked',
    'SUMMARY: what you changed, in 1-3 sentences',
    'FILES: files you created or edited',
    'OUTPUT: results that aren\'t code (a draft, a CSV, an image), attached with attach_file, or "none"',
    'NEXT: anything I still need to do, or "none"',
    '```',
  ].join('\n');
}

function metaLine(ticket: PromptTicket, now: Date): string {
  const meta = [`Priority: ${PRIORITY_LABELS[ticket.priority]}`, `Status: ${ticket.statusName}`];
  if (ticket.due) meta.push(`Due: ${formatShortDay(ticket.due, now)}`);
  if (ticket.assignee) meta.push(`Assignee: ${ticket.assignee}`);
  if (ticket.labels?.length)
    meta.push(`Labels: ${ticket.labels.map((label) => label.name).join(', ')}`);
  return meta.join(' · ');
}

export function ticketBlock(ticket: PromptTicket, heading: string, now: Date = new Date()): string {
  const out = [
    `${heading} ${ticket.key}: ${ticket.title || 'Untitled'}`,
    metaLine(ticket, now),
    '',
    ticket.description.trim() || '(No description.)',
  ];
  if (ticket.notes.length > 0) {
    out.push('', 'Notes:', ...ticket.notes.map((note) => `- ${note.replace(/\s*\n+\s*/g, ' ')}`));
  }
  if (ticket.lastReport) out.push('', 'Your last report on this ticket:', ticket.lastReport);
  if (ticket.lastReview) {
    const { verdict, rating, text } = ticket.lastReview;
    out.push('', `Last review: ${VERDICT_LABELS[verdict]} · ${rating}/5`, text);
  }
  return out.join('\n');
}

// Under claude -p nobody answers in the chat, so a run asks on the phone through the tracker.
export const ASK_PERSON_LINE =
  "If a decision only I can make blocks the work, ask me with the tracker's ask_person tool instead of guessing.";

export function repoLine(project: PromptProject): string[] {
  return project.repo ? [`Repository / folder: ${project.repo}`] : [];
}

export const instructionLines = (
  project: PromptProject,
  labels?: readonly PromptLabel[],
): string[] => {
  const block = instructionsBlock(project, '##', labels);
  return block.length > 0 ? ['', ...block] : [];
};

export function buildTicketPrompt(
  project: PromptProject,
  ticket: PromptTicket,
  now: Date = new Date(),
): string {
  return [
    `Please work on ticket ${ticket.key} from my "${project.name}" project.`,
    ...repoLine(project),
    ...instructionLines(project, ticket.labels),
    '',
    ticketBlock(ticket, '##', now),
    ...ticketSubAgentLines(project.maxSubAgents),
    '',
    ASK_PERSON_LINE,
    '',
    '## When you finish',
    'End your reply with this block, filled in, so I can paste it back into my tracker:',
    '',
    replyFormat(ticket.key),
  ].join('\n');
}

export type BatchPromptTicket = Pick<PromptTicket, 'key' | 'title' | 'priority'>;

const subAgentRules = (limit: number): string[] => [
  `- Give each ticket to a sub agent of its own (the Agent tool). Run at most ${limit} sub agents at once.`,
  '- As soon as a sub agent ends, give the next ticket to a new one, until every ticket is done.',
  '- Each sub agent works on its one ticket with the tracker tools, as a single ticket run does:',
  '  1. claim_ticket to move it to In progress and read it in full.',
  '  2. Do the work. Record decisions and blockers with add_comment.',
  '  3. When the work is done and checked, submit_for_review with a summary, the files and what I still need to do. When it is blocked, say why with add_comment and leave it In progress.',
  '  Never move a ticket to Done.',
  '- The sub agents share this folder. Each one changes only what its own ticket needs and leaves all other changes alone.',
  '- When a ticket fails, go on with the others.',
];

// The tickets are listed, not written out: each sub agent reads its own with claim_ticket, so the
// prompt stays small however many tickets the batch holds.
export function buildBatchPrompt(
  project: PromptProject,
  tickets: readonly BatchPromptTicket[],
  limit: number,
): string {
  return [
    `Please work on these ${tickets.length} tickets from my "${project.name}" project with sub agents.`,
    ...repoLine(project),
    '',
    '## Tickets',
    ...tickets.map(
      (ticket) =>
        `- ${ticket.key} · ${PRIORITY_LABELS[ticket.priority]} · ${ticket.title || 'Untitled'}`,
    ),
    '',
    '## How to work',
    ...subAgentRules(limit),
    '',
    '## When you finish',
    'List every ticket with how it ended: done, blocked or failed, and why for each that did not finish.',
    'Then, for each ticket, end your reply with one block like this, filled in, so I can paste it back into my tracker:',
    '',
    replyFormat(`${project.key}-<number>`),
  ].join('\n');
}

export function buildProjectPrompt(
  project: PromptProject,
  tickets: readonly PromptTicket[],
  now: Date = new Date(),
): string {
  const lines = [
    `Here are the open tickets for my "${project.name}" project. Work through them in order, highest priority first, and check with me before large or risky changes.`,
    ...repoLine(project),
    ...instructionLines(project, distinctLabels(tickets)),
  ];
  for (const ticket of tickets) lines.push('', '---', '', ticketBlock(ticket, '###', now));
  lines.push(
    '',
    '---',
    '',
    '## When you finish',
    'For each ticket you worked on, end your reply with one block like this, filled in, so I can paste it back into my tracker:',
    '',
    replyFormat(`${project.key}-<number>`),
  );
  return lines.join('\n');
}
