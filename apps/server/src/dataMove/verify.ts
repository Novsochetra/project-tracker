import type { AttachmentRow, Db } from '../db/schema';
import { createLimiter } from '../images/limiter';
import type { FileStorage } from '../storage/fileStorage';
import { idsOf, inChunks, type TableRows } from './rows';
import { COPIED_TABLE_NAMES, type CopiedTableName } from './tables';
import { countIds } from './targetState';

export interface TableCheck {
  name: CopiedTableName;
  expected: number;
  found: number;
}

export interface FileCheck {
  key: string;
  expected: number;
  // Null when storage has no object under the key.
  found: number | null;
}

export interface Verification {
  tables: TableCheck[];
  files: FileCheck[];
}

// A few HEAD requests at a time: one at a time over a laptop's link to S3 adds up for many files.
const statLimit = createLimiter(8);

async function storedAttachments(db: Db, ids: readonly string[]): Promise<AttachmentRow[]> {
  const rows: AttachmentRow[] = [];
  for (const chunk of inChunks(ids)) {
    rows.push(
      ...(await db.selectFrom('attachments').selectAll().where('id', 'in', chunk).execute()),
    );
  }
  return rows;
}

// Reads back what the target holds: the moved rows by id, and for each attachment row its object.
export async function verifyMove(
  db: Db,
  storage: FileStorage,
  rows: TableRows,
): Promise<Verification> {
  const tables: TableCheck[] = [];
  for (const name of COPIED_TABLE_NAMES) {
    const ids = idsOf(rows[name]);
    tables.push({ name, expected: ids.length, found: await countIds(db, name, ids) });
  }
  const stored = await storedAttachments(db, idsOf(rows.attachments));
  const files = await Promise.all(
    stored.map((row) =>
      statLimit(async () => ({
        key: row.storageKey,
        expected: row.size,
        found: (await storage.stat(row.storageKey))?.size ?? null,
      })),
    ),
  );
  return { tables, files };
}

export function verificationProblems({ tables, files }: Verification): string[] {
  const rows = tables
    .filter((table) => table.found !== table.expected)
    .map((table) => `${table.name}: ${table.found} of ${table.expected} rows are in the target.`);
  const missing = files
    .filter((file) => file.found === null)
    .map((file) => `${file.key}: no file in the target storage.`);
  const resized = files
    .filter((file) => file.found !== null && file.found !== file.expected)
    .map((file) => `${file.key}: ${file.found} bytes stored, the row says ${file.expected}.`);
  return [...rows, ...missing, ...resized];
}
