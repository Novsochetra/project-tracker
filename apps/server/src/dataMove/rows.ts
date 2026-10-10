import type { Database, Db } from '../db/schema';
import { COPIED_TABLE_NAMES, type CopiedTableName } from './tables';

export type TableRows = { [T in CopiedTableName]: Database[T][] };

export type TableCounts = Record<CopiedTableName, number>;

// Postgres takes at most 65,535 values a statement; 500 rows of the widest table (13 columns) stay
// far below that and below SQLite's 32,766.
const ROWS_PER_STATEMENT = 500;

export function inChunks<T>(items: readonly T[], size = ROWS_PER_STATEMENT): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

export const idsOf = (rows: readonly { id: string }[]): string[] => rows.map((row) => row.id);

export async function readRows(db: Db): Promise<TableRows> {
  const entries = await Promise.all(
    COPIED_TABLE_NAMES.map(
      async (name) => [name, await db.selectFrom(name).selectAll().execute()] as const,
    ),
  );
  return Object.fromEntries(entries) as unknown as TableRows;
}

export const rowCounts = (rows: TableRows): TableCounts =>
  Object.fromEntries(COPIED_TABLE_NAMES.map((name) => [name, rows[name].length])) as TableCounts;

// One transaction: a run that fails anywhere keeps none of the rows. onInserted runs once every
// insert has gone through, just before the commit, which is the one step whose failure leaves it
// unknown whether the rows are there.
export async function insertRows(db: Db, rows: TableRows, onInserted = () => {}): Promise<void> {
  await db.transaction().execute(async (trx) => {
    for (const name of COPIED_TABLE_NAMES) {
      for (const chunk of inChunks<object>(rows[name])) {
        await trx
          .insertInto(name)
          .values(chunk as never)
          .execute();
      }
    }
    onInserted();
  });
}
