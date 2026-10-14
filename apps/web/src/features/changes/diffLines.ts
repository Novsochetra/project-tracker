import type { DiffFile, DiffLine, DiffSide } from '@tracker/shared';

export interface LineAt {
  side: DiffSide;
  line: number;
}

// A removed line is commented on the old side; an added or kept one on the new side.
export const lineAt = (line: DiffLine): LineAt =>
  line.kind === 'del'
    ? { side: 'old', line: line.oldLine ?? 0 }
    : { side: 'new', line: line.newLine ?? 0 };

export const sameLine = (a: LineAt, b: LineAt): boolean => a.side === b.side && a.line === b.line;

// Viewed holds the digest of the file's change when it was ticked: a file that changed since
// reads as not viewed.
export const isViewed = (file: DiffFile, viewed: Readonly<Record<string, string>>): boolean =>
  viewed[file.path] === file.digest;

export const viewedCount = (
  files: readonly DiffFile[],
  viewed: Readonly<Record<string, string>>,
): number => files.filter((file) => isViewed(file, viewed)).length;

const KIND_NAMES = { add: 'Added line', del: 'Removed line', context: 'Line' } as const;

// What a screen reader hears before the code, which the numbers and sign only show.
export function lineName(line: DiffLine): string {
  const { line: number } = lineAt(line);
  return `${KIND_NAMES[line.kind]} ${number}: `;
}

export const SIGNS = { add: '+', del: '−', context: '' } as const;
