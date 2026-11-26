import type { Database as SqliteDatabase } from 'better-sqlite3';
import { SqliteAdapter } from 'kysely';
import type { Db } from './schema';

// SQLite's own lower() changes only A–Z, so "été" missed "Été". This one lowercases as JavaScript
// does, which the ticket list filter uses too. A new name, so SQLite's lower() stays as it is.
export const UNICODE_LOWER = 'unicode_lower';

export const unicodeLower = (value: unknown): unknown =>
  typeof value === 'string' ? value.toLowerCase() : value;

export function registerUnicodeLower(database: SqliteDatabase): void {
  database.function(UNICODE_LOWER, { deterministic: true }, unicodeLower);
}

// Postgres's lower() already knows accented capitals.
export const lowerFunction = (db: Db): typeof UNICODE_LOWER | 'lower' =>
  db.getExecutor().adapter instanceof SqliteAdapter ? UNICODE_LOWER : 'lower';
