import { isPriority, type Priority } from '../domain/priority';
import { TICKET_DESCRIPTION_MAX, TICKET_TITLE_MAX } from '../domain/ticket';
import { codeFences } from './codeFences';

export interface TicketCard {
  title: string;
  priority: Priority;
  description: string;
}

// `index` counts the cards only, so it names a card whatever text surrounds it.
export type CardSegment =
  { kind: 'text'; text: string } | { kind: 'card'; index: number; card: TicketCard };

const FIELD = /^(title|priority)[ \t]*:[ \t]*(.*)$/i;
const SEPARATOR = /^-{3,}[ \t]*$/;

// Every other code block is skipped whole, so a card shown inside one stays code, as Markdown
// renders it.
const ticketFences = (lines: readonly string[]) =>
  codeFences(lines).filter(
    ({ end, marker, info }) =>
      end !== -1 && marker.startsWith('`') && info.toLowerCase() === 'ticket',
  );

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

function pushText(segments: CardSegment[], lines: readonly string[]): void {
  const text = lines.join('\n').trim();
  if (text) segments.push({ kind: 'text', text });
}

// A card with no title or no closing fence stays text, never half a ticket.
export function splitTicketCards(text: string): CardSegment[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const segments: CardSegment[] = [];
  let from = 0;
  let index = 0;
  for (const fence of ticketFences(lines)) {
    const card = parseBody(lines.slice(fence.start + 1, fence.end));
    if (!card) continue;
    pushText(segments, lines.slice(from, fence.start));
    segments.push({ kind: 'card', index, card });
    index += 1;
    from = fence.end + 1;
  }
  pushText(segments, lines.slice(from));
  return segments;
}

export const ticketCards = (text: string): TicketCard[] =>
  splitTicketCards(text).flatMap((segment) => (segment.kind === 'card' ? [segment.card] : []));
