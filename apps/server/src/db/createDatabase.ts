import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import SQLite from 'better-sqlite3';
import { CamelCasePlugin, Kysely, PostgresDialect, SqliteDialect, type Dialect } from 'kysely';
import pg from 'pg';
import type { Database, Db } from './schema';

const INT8_OID = 20;

export const isPostgresUrl = (url: string): boolean => /^postgres(ql)?:\/\//i.test(url);

export function createKysely(dialect: Dialect): Db {
  return new Kysely<Database>({ dialect, plugins: [new CamelCasePlugin()] });
}

function sqliteDialect(file: string): Dialect {
  const inMemory = file === ':memory:';
  if (!inMemory) mkdirSync(dirname(file), { recursive: true });
  const database = new SQLite(file);
  if (!inMemory) database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  return new SqliteDialect({ database });
}

function postgresDialect(connectionString: string): Dialect {
  const types = new pg.TypeOverrides();
  // Timestamps are epoch-ms bigints; they fit safely in a JS number.
  types.setTypeParser(INT8_OID, (value: string) => Number(value));
  return new PostgresDialect({ pool: new pg.Pool({ connectionString, types }) });
}

export function createDatabase(url: string): Db {
  return createKysely(isPostgresUrl(url) ? postgresDialect(url) : sqliteDialect(url));
}
