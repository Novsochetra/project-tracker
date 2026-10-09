import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AttachmentRow } from '../db/schema';
import { checkedKey } from '../storage/fileStorage';

export interface SourceFile {
  row: AttachmentRow;
  path: string;
  // Null when the uploads folder has no file under the row's key.
  size: number | null;
}

async function sizeOf(path: string): Promise<number | null> {
  const info = await stat(path).catch(() => null);
  return info?.isFile() ? info.size : null;
}

// A key the server could not have made (one reaching outside the folder) counts as missing.
const isSafeKey = (key: string): boolean => {
  try {
    return checkedKey(key) === key;
  } catch {
    return false;
  }
};

export async function findSourceFiles(
  dir: string,
  rows: readonly AttachmentRow[],
): Promise<SourceFile[]> {
  return Promise.all(
    rows.map(async (row) => {
      const path = join(dir, row.storageKey);
      return { row, path, size: isSafeKey(row.storageKey) ? await sizeOf(path) : null };
    }),
  );
}

const listed = (keys: readonly string[]): string =>
  keys.length <= 10
    ? keys.join(', ')
    : `${keys.slice(0, 10).join(', ')} and ${keys.length - 10} more`;

// Either would leave a row online that points at no file, or at one of another size.
export function sourceFileProblems(dir: string, files: readonly SourceFile[]): string[] {
  const missing = files.filter((file) => file.size === null).map((file) => file.row.storageKey);
  const resized = files
    .filter((file) => file.size !== null && file.size !== file.row.size)
    .map((file) => file.row.storageKey);
  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(`${missing.length} attachment file(s) are not in ${dir}: ${listed(missing)}.`);
  }
  if (resized.length > 0) {
    problems.push(
      `${resized.length} file(s) in ${dir} differ in size from their rows: ${listed(resized)}.`,
    );
  }
  return problems;
}

export const totalBytes = (files: readonly { size: number | null }[]): number =>
  files.reduce((sum, file) => sum + (file.size ?? 0), 0);
