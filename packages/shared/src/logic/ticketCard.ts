import { isPriority, type Priority } from '../domain/priority';
import { TICKET_DESCRIPTION_MAX, TICKET_TITLE_MAX } from '../domain/ticket';

export interface TicketCard {
  title: string;
  priority: Priority;
  description: string;
}

export interface CardSplit {
  before: string;
  card: TicketCard;
  after: string;
}

const OPEN = /^(`{3,})ticket[ \t]*$/i;
const FIELD = /^(title|priority)[ \t]*:[ \t]*(.*)$/i;
const SEPARATOR = /^-{3,}[ \t]*$/;

interface Fence {
  start: number;
  end: number;
}

// As in Markdown, only a fence at least as long closes it, so a description can hold ``` blocks.
function closingLine(lines: readonly string[], from: number, ticks: number): number {
  for (let i = from; i < lines.length; i += 1) {
    const close = /^(`{3,})[ \t]*$/.exec(lines[i] ?? '');
    if (close?.[1] && close[1].length >= ticks) return i;
  }
  return -1;
}

function lastFence(lines: readonly string[]): Fence | null {
  let found: Fence | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const ticks = OPEN.exec(lines[i] ?? '')?.[1]?.length;
    if (!ticks) continue;
    const end = closingLine(lines, i + 1, ticks);
    if (end === -1) break;
    found = { start: i, end };
    i = end;
  }
  return found;
}

function parseBody(body: readonly string[]): TicketCard | null {
  const split = body.findIndex((line) => SEPARATOR.test(line));
  const head = split === -1 ? body : body.slice(0, split);
  const fields = new Map<string, string>();
  for (const line of head) {
    const field = FIELD.exec(line.trim());
    if (field?.[1] && field[2] !== undefined) fields.set(field[1].toLowerCase(), field[2].trim());
  }
  const title = fields.get('title')?.slice(0, TICKET_TITLE_MAX).trim();
  if (!title) return null;
  const priority = fields.get('priority')?.toLowerCase();
  const description = split === -1 ? '' : body.slice(split + 1).join('\n');
  return {
    title,
    priority: isPriority(priority) ? priority : 'medium',
    description: description.trim().slice(0, TICKET_DESCRIPTION_MAX),
  };
}

// The last card wins, since Claude sends a new card when the person asks for a change.
export function splitTicketCard(text: string): CardSplit | null {
  const lines = text.replace(/\r/g, '').split('\n');
  const fence = lastFence(lines);
  if (!fence) return null;
  const card = parseBody(lines.slice(fence.start + 1, fence.end));
  if (!card) return null;
  return {
    before: lines.slice(0, fence.start).join('\n').trim(),
    card,
    after: lines
      .slice(fence.end + 1)
      .join('\n')
      .trim(),
  };
}
