import { attachmentKind, formatBytes } from '@tracker/shared';
import type { MovedAttachment } from './movedAttachment';
import { COPIED_TABLE_NAMES, SKIPPED_TABLES, type CopiedTableName } from './tables';
import type { TableCounts } from './rows';

const LABELS: Record<CopiedTableName, readonly [string, string]> = {
  projects: ['project', 'projects'],
  statuses: ['status', 'statuses'],
  tickets: ['ticket', 'tickets'],
  activities: ['activity entry', 'activity entries'],
  attachments: ['attachment', 'attachments'],
};

const counted = (count: number, [one, many]: readonly [string, string]): string =>
  `${count} ${count === 1 ? one : many}`;

// "1 project, 130 tickets": the tables that have rows, '' when none has.
export function describeCounts(counts: Partial<TableCounts>): string {
  return COPIED_TABLE_NAMES.filter((name) => (counts[name] ?? 0) > 0)
    .map((name) => counted(counts[name] ?? 0, LABELS[name]))
    .join(', ');
}

export interface FileTotals {
  count: number;
  bytes: number;
}

export function planLines(counts: TableCounts, files: FileTotals): string[] {
  const numbers = [...COPIED_TABLE_NAMES.map((name) => counts[name]), files.count].map(String);
  const width = Math.max(...numbers.map((number) => number.length));
  const row = (name: string, count: number) =>
    `  ${name.padEnd('attachments'.length)}  ${String(count).padStart(width)}`;
  return [
    'To copy:',
    ...COPIED_TABLE_NAMES.map((name) => row(name, counts[name])),
    `${row('files', files.count)} (${formatBytes(files.bytes)})`,
    `Not copied: ${Object.keys(SKIPPED_TABLES).join(', ')} (sign-in, helpers and chats stay with ` +
      'each tracker: set the online owner with owner-set, make new API tokens online and start ' +
      'tracker watch against it).',
  ];
}

export interface CompressionTotals {
  images: number;
  compressed: number;
  bytesBefore: number;
  bytesAfter: number;
}

export function compressionTotals(moved: readonly MovedAttachment[]): CompressionTotals {
  const images = moved.filter(({ before }) => attachmentKind(before.mimeType) === 'image');
  const compressed = images.filter((file) => file.compressed);
  const sum = (sizes: number[]) => sizes.reduce((total, size) => total + size, 0);
  return {
    images: images.length,
    compressed: compressed.length,
    bytesBefore: sum(compressed.map(({ before }) => before.size)),
    bytesAfter: sum(compressed.map(({ after }) => after.size)),
  };
}

export function compressionLine(totals: CompressionTotals, dryRun: boolean): string {
  const verb = dryRun ? 'Would compress or strip' : 'Compressed or stripped';
  const saving =
    totals.compressed > 0
      ? ` (${formatBytes(totals.bytesBefore)} → ${formatBytes(totals.bytesAfter)})`
      : '';
  return `${verb} ${totals.compressed} of ${totals.images} images, as new uploads are${saving}.`;
}

export const checkedLine = (counts: TableCounts): string =>
  `Checked: the target has every row moved (${describeCounts(counts) || 'none'}) and every ` +
  "attachment's file, at its size. Done.";

export function renamedTextsLine(texts: number): string[] {
  if (texts === 0) return [];
  return [
    `${texts} ticket or comment text(s) name a compressed image by its old file name or key. ` +
      'They still read the same and the image keeps its id and place; only the name shown ' +
      'ends in .webp now.',
  ];
}
