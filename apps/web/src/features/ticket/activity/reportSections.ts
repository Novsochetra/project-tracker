import { normalizeReportStatus, type StatusCategory } from '@tracker/shared';

export interface ReportSections {
  status: { category: StatusCategory | null; text: string } | null;
  summary: string;
  files: string[];
  next: string | null;
}

type Field = 'ticket' | 'status' | 'summary' | 'files' | 'next';

// Tolerates the Markdown that parseReport tolerates around TICKET and STATUS: quotes, bullets,
// bold and code marks, and a full-width colon. Only marks right after the colon close the label;
// after a space they belong to the value ("SUMMARY: `useAuth` retries").
const LABEL = /^[\s>*_`#-]*(TICKET|STATUS|SUMMARY|FILES?|NEXT)[\s*_`]*[:：](?:[*_]+|`)?\s*(.*)$/i;
const NONE = /^(none|n\/a|nothing)\.?$/i;
const BULLET = /^[-*•]\s+/;
const CODE = /^`(.+)`$/;

const fieldOf = (label: string): Field => {
  const name = label.toLowerCase();
  return name === 'file' ? 'files' : (name as Field);
};

// Lines after a label belong to it. Anything before the first label, or a label given twice,
// means the text isn't a plain report, so it keeps its raw look.
function readFields(text: string): Map<Field, string> | null {
  const fields = new Map<Field, string>();
  let current: Field | null = null;
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const match = LABEL.exec(line);
    if (match) {
      current = fieldOf(match[1] ?? '');
      if (fields.has(current)) return null;
      fields.set(current, match[2] ?? '');
    } else if (current) {
      fields.set(current, `${fields.get(current) ?? ''}\n${line}`);
    } else if (line.trim()) {
      return null;
    }
  }
  return fields;
}

const fileName = (item: string): string =>
  item.trim().replace(BULLET, '').replace(CODE, '$1').trim();

function fileList(value: string): string[] {
  const files = value.split(/[\n,]/).map(fileName).filter(Boolean);
  return files.length === 1 && NONE.test(files[0] ?? '') ? [] : files;
}

function nextStep(value: string): string | null {
  const next = value.trim();
  return next && !NONE.test(next) ? next : null;
}

function statusOf(value: string | undefined): ReportSections['status'] {
  const text = value?.replace(/[*_`]/g, '').trim();
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
