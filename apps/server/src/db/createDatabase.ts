import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import SQLite from 'better-sqlite3';
import { CamelCasePlugin, Kysely, PostgresDialect, type Dialect } from 'kysely';
import { createPostgresPool } from './postgresPool';
import type { Database, Db } from './schema';
import { TrackerSqliteDialect } from './sqliteDialect';
import { StripNulPlugin } from './stripNul';

export const isPostgresUrl = (url: string): boolean => /^postgres(ql)?:\/\//i.test(url);

export function createKysely(dialect: Dialect): Db {
  return new Kysely<Database>({ dialect, plugins: [new CamelCasePlugin(), new StripNulPlugin()] });
}

function sqliteDialect(file: string): Dialect {
  const inMemory = file === ':memory:';
  if (!inMemory) mkdirSync(dirname(file), { recursive: true });
  const database = new SQLite(file);
  if (!inMemory) database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  return new TrackerSqliteDialect(database);
}

// env carries the Postgres pool settings (DATABASE_POOL_MAX, DATABASE_STATEMENT_TIMEOUT_MS,
// PGSSLMODE); SQLite needs none.
export function createDatabase(url: string, env: NodeJS.ProcessEnv = process.env): Db {
  return createKysely(
    isPostgresUrl(url)
      ? new PostgresDialect({ pool: createPostgresPool(url, env) })
      : sqliteDialect(url),
  );
}
