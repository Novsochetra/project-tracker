import { normalizeReportStatus, type StatusCategory } from '@tracker/shared';

export interface ReportSections {
  status: { category: StatusCategory | null; text: string } | null;
  summary: string;
  files: string[];
  next: string | null;
}

type Field = 'ticket' | 'status' | 'summary' | 'files' | 'next';

interface Label {
  field: Field;
  value: string;
  capital: boolean;
}

interface Line {
  text: string;
  label: Label | null;
}

// Tolerates the Markdown that parseReport tolerates around TICKET and STATUS: quotes, bullets,
// bold and code marks, and a full-width colon. Only marks right after the colon close the label;
// after a space they belong to the value ("SUMMARY: `useAuth` retries").
const LABEL = /^[\s>*_`#-]*(TICKET|STATUS|SUMMARY|FILES?|NEXT)[\s*_`]*[:：](?:[*_]+|`)?\s*(.*)$/i;
const NONE = /^(none|n\/a|nothing)\.?$/i;
const MARKS = /[*_`]/g;
const BULLET = /^[-*•]\s+/;
const CODE = /^`(.+)`$/;
const OPENERS = new Set(['(', '[', '{']);
const CLOSERS = new Set([')', ']', '}']);

const fieldOf = (label: string): Field => {
  const name = label.toLowerCase();
  return name === 'file' ? 'files' : (name as Field);
};

function labelOf(line: string): Label | null {
  const match = LABEL.exec(line);
  if (!match) return null;
  const word = match[1] ?? '';
  return { field: fieldOf(word), value: match[2] ?? '', capital: word === word.toUpperCase() };
}

// Submissions write their labels in capitals. When a field has a capital label, a line that only
// starts with the same word, such as "Next: …" or "Status: …" in a summary, is text.
function readLines(text: string): Line[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => ({ text: line, label: labelOf(line) }));
  const capital = new Set(lines.flatMap(({ label }) => (label?.capital ? [label.field] : [])));
  return lines.map((line) =>
    line.label && !line.label.capital && capital.has(line.label.field)
      ? { ...line, label: null }
      : line,
  );
}

// Text before the first label, or a label given twice, means it isn't a plain report, so it keeps
// its raw look.
function readFields(text: string): Map<Field, string> | null {
  const fields = new Map<Field, string>();
  let current: Field | null = null;
  for (const { text: line, label } of readLines(text)) {
    if (label) {
      current = label.field;
      if (fields.has(current)) return null;
      fields.set(current, label.value);
    } else if (current) {
      fields.set(current, `${fields.get(current) ?? ''}\n${line}`);
    } else if (line.trim()) {
      return null;
    }
  }
  return fields;
}

// Markdown around it, as in "**none**", still says none.
const saysNone = (value: string): boolean => NONE.test(value.replace(MARKS, '').trim());

const fileName = (item: string): string =>
  item.trim().replace(BULLET, '').replace(CODE, '$1').trim();

// Commas inside brackets belong to a note, as in "src/a.ts (parser, tests)".
function splitOnCommas(line: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (OPENERS.has(char)) depth += 1;
    else if (CLOSERS.has(char)) depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      parts.push(line.slice(start, index));
      start = index + 1;
    }
  }
  return [...parts, line.slice(start)];
}

function fileList(value: string): string[] {
  const lines = value.split('\n').filter((line) => line.trim());
  const items = lines.length > 1 ? lines : lines.flatMap(splitOnCommas);
  const files = items.map(fileName).filter(Boolean);
  return files.length === 1 && saysNone(files[0] ?? '') ? [] : files;
}

function nextStep(value: string): string | null {
  const next = value.trim();
  return next && !saysNone(next) ? next : null;
}

function statusOf(value: string | undefined): ReportSections['status'] {
  const text = value?.replace(MARKS, '').trim();
  return text ? { category: normalizeReportStatus(text), text } : null;
}

export function reportSections(text: string): ReportSections | null {
  const fields = readFields(text);
  const summary = fields?.get('summary')?.trim();
  if (!fields || !summary) return null;
  return {
    status: statusOf(fields.get('status')),
    summary,
    files: fileList(fields.get('files') ?? ''),
    next: nextStep(fields.get('next') ?? ''),
  };
}
