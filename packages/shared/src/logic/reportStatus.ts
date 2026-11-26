import type { StatusCategory } from '../domain/status';

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
