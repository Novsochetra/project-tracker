import type { StatusCategory } from '../domain/status';

export interface ParsedReportBlock {
  key: string | null;
  category: StatusCategory | null;
  text: string;
}

const TICKET_LINE = /^[\s>*_`#-]*TICKET[\s*_`]*[:：]\s*[*_`]*\s*([A-Za-z0-9]+-\d+)/i;
const STATUS_LINE = /STATUS[\s*_`]*[:：]\s*(.+)/i;
const FENCE_LINE = /^\s*```/;

const STATUS_RULES: readonly (readonly [RegExp, StatusCategory])[] = [
  [/\b(reviewed|approved|verified)\b/, 'reviewed'],
  [/\b(done|complete|completed|fixed|finished|resolved)\b/, 'in_review'],
  [/\b(needs? review|ready for review|in review|review)\b/, 'in_review'],
  [/not started/, 'todo'],
  [/(progress|partial|blocked|wip|started|ongoing)/, 'in_progress'],
  [/to ?do/, 'todo'],
];

export function normalizeReportStatus(raw: string): StatusCategory | null {
  const value = raw.toLowerCase();
  return STATUS_RULES.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

interface RawBlock {
  key: string | null;
  lines: string[];
}

function splitBlocks(text: string): RawBlock[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => !FENCE_LINE.test(line));
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  for (const line of lines) {
    const key = TICKET_LINE.exec(line)?.[1];
    if (key) {
      current = { key: key.toUpperCase(), lines: [line.replace(/[*_`]/g, '').trim()] };
      blocks.push(current);
      continue;
    }
    if (!current) {
      current = { key: null, lines: [] };
      blocks.push(current);
    }
    current.lines.push(line);
  }
  return blocks;
}

export function parseReport(text: string): ParsedReportBlock[] {
  const blocks = splitBlocks(text);
  const keyed = blocks.filter((block) => block.key);
  const used = keyed.length > 0 ? keyed : blocks.filter((block) => block.lines.join('').trim());
  return used.map((block) => {
    const body = block.lines.join('\n').trim();
    const status = STATUS_LINE.exec(body)?.[1];
    return { key: block.key, category: status ? normalizeReportStatus(status) : null, text: body };
  });
}
