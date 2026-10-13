import { VERDICT_LABELS, type ReviewVerdict } from '../domain/activity';
import { PRIORITY_LABELS, type Priority } from '../domain/priority';
import { formatShortDay } from './format';

export interface PromptProject {
  name: string;
  key: string;
  repo: string;
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
}

function replyFormat(key: string): string {
  return [
    '```',
    `TICKET: ${key}`,
    'STATUS: done | in progress | blocked',
    'SUMMARY: what you changed, in 1-3 sentences',
    'FILES: files you created or edited',
    'NEXT: anything I still need to do, or "none"',
    '```',
  ].join('\n');
}

function metaLine(ticket: PromptTicket, now: Date): string {
  const meta = [`Priority: ${PRIORITY_LABELS[ticket.priority]}`, `Status: ${ticket.statusName}`];
  if (ticket.due) meta.push(`Due: ${formatShortDay(ticket.due, now)}`);
  if (ticket.assignee) meta.push(`Assignee: ${ticket.assignee}`);
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

export function repoLine(project: PromptProject): string[] {
  return project.repo ? [`Repository / folder: ${project.repo}`] : [];
}

export function buildTicketPrompt(
  project: PromptProject,
  ticket: PromptTicket,
  now: Date = new Date(),
): string {
  return [
    `Please work on ticket ${ticket.key} from my "${project.name}" project.`,
    ...repoLine(project),
    '',
    ticketBlock(ticket, '##', now),
    '',
    '## When you finish',
    'End your reply with this block, filled in, so I can paste it back into my tracker:',
    '',
    replyFormat(ticket.key),
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
