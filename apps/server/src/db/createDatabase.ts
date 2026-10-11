import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import SQLite from 'better-sqlite3';
import { CamelCasePlugin, Kysely, PostgresDialect, type Dialect } from 'kysely';
import { createPostgresPool } from './postgresPool';
import type { Database, Db } from './schema';
import { TrackerSqliteDialect } from './sqliteDialect';
import { StripNulPlugin } from './stripNul';

export const isPostgresUrl = (url: string): boolean => /^postgres(ql)?:\/\//i.test(url);

// A URL, typo or not, wherever it starts (quotes, a space or its name in front): as a SQLite path,
// postgresql:/user:pw@… (one slash) was printed and made folders named after the password. A scheme
// is two or more letters before :/ (a Windows drive has one); with no slash only postgres: counts, so
// a file name holding a colon (tracker-10:30.db) stays a path, as it was before PT-137. A colon
// with an @ after it is a user:password@ whatever the scheme, so a password is never printed, also
// percent-encoded as copied from a query string or a log.
export const looksLikeUrl = (url: string): boolean =>
  /:\/\/|[a-z]{2}:\/|postgres(ql)?:|:[^@]*@/i.test(url.replace(/%3a/gi, ':').replace(/%40/g, '@'));

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
  // A postgres:// URL pasted with quotes or its name in front, or mistyped, would open a SQLite file
  // at a path holding the password.
  if (!isPostgresUrl(url) && looksLikeUrl(url)) {
    throw new Error(
      'DATABASE_URL is neither a postgres:// URL nor a file path (its value is not shown): it should start with postgres:// or postgresql://, without quotes or a name in front. A file path can’t hold a colon followed by an @.',
    );
  }
  return createKysely(
    isPostgresUrl(url)
      ? new PostgresDialect({ pool: createPostgresPool(url, env) })
      : sqliteDialect(url),
  );
}
