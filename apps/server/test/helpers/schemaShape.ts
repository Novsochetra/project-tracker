import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Db } from '../../src/db/schema';
import type { TestDialect } from './server';

// What a migration can change, per table: columns in order, indexes and foreign keys. The exact
// shape keeps each database's own names (SQLite's autoindexes, Postgres' constraints), for
// comparing one database before and after; the portable shape drops them, for comparing the two.
export interface TableShape {
  columns: string[];
  indexes: string[];
  foreignKeys: string[];
}

export type SchemaShape = Record<string, TableShape>;

interface Column {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

interface Index {
  name: string;
  unique: boolean;
  columns: string[];
}

interface ForeignKey {
  column: string;
  table: string;
  references: string;
  onDelete: string;
}

interface RawTable {
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
  constraints: string[];
}

type Raw = Kysely<unknown>;

const rows = async <T>(db: Raw, query: RawBuilder<T>): Promise<T[]> =>
  (await query.execute(db)).rows;

async function sqliteTable(db: Raw, table: string): Promise<RawTable> {
  const columns = await rows<{
    name: string;
    type: string;
    nn: number;
    dflt: string | null;
    pk: number;
  }>(
    db,
    sql`select name, type, "notnull" as nn, dflt_value as dflt, pk from pragma_table_info(${table}) order by cid`,
  );
  const indexList = await rows<{ name: string; uniq: number; origin: string }>(
    db,
    sql`select name, "unique" as uniq, origin from pragma_index_list(${table})`,
  );
  const indexes = await Promise.all(
    indexList
      .filter((index) => index.origin !== 'pk')
      .map(async (index) => ({
        name: index.name,
        unique: index.uniq === 1,
        columns: (
          await rows<{ name: string }>(
            db,
            sql`select name from pragma_index_info(${index.name}) order by seqno`,
          )
        ).map((column) => column.name),
      })),
  );
  const foreignKeys = await rows<{ table: string; from: string; to: string; on_delete: string }>(
    db,
    sql`select "table", "from", "to", on_delete from pragma_foreign_key_list(${table})`,
  );
  return {
    columns: columns.map((column) => ({
      name: column.name,
      type: column.type.toLowerCase(),
      notNull: column.nn === 1,
      primaryKey: column.pk > 0,
      defaultValue: column.dflt,
    })),
    indexes,
    foreignKeys: foreignKeys.map((key) => ({
      column: key.from,
      table: key.table,
      references: key.to,
      onDelete: key.on_delete.toLowerCase(),
    })),
    constraints: [],
  };
}

const FOREIGN_KEY = /^FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)(?: ON DELETE ([A-Z ]+))?$/;

function parseForeignKey(definition: string): ForeignKey[] {
  const match = FOREIGN_KEY.exec(definition);
  if (!match) return [];
  const [, column = '', table = '', references = '', onDelete = 'NO ACTION'] = match;
  return [{ column, table, references, onDelete: onDelete.toLowerCase() }];
}

async function postgresColumns(db: Raw, table: string): Promise<Column[]> {
  const primary = await rows<{ name: string }>(
    db,
    sql`select a.attname as name from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = ${table}::regclass and i.indisprimary`,
  );
  const columns = await rows<{ name: string; type: string; nullable: string; dflt: string | null }>(
    db,
    sql`select column_name as name, data_type as type, is_nullable as nullable, column_default as dflt
      from information_schema.columns where table_schema = 'public' and table_name = ${table}
      order by ordinal_position`,
  );
  const keys = new Set(primary.map((column) => column.name));
  return columns.map((column) => ({
    name: column.name,
    type: column.type,
    notNull: column.nullable === 'NO',
    primaryKey: keys.has(column.name),
    defaultValue: column.dflt?.replace(/::[\w ]+$/, '') ?? null,
  }));
}

async function postgresTable(db: Raw, table: string): Promise<RawTable> {
  const indexes = await rows<{
    name: string;
    unique: boolean;
    primary: boolean;
    columns: string[];
  }>(
    db,
    sql`select i.relname as name, ix.indisunique as unique, ix.indisprimary as primary,
      array(select a.attname::text from unnest(ix.indkey::int2[]) with ordinality as k(attnum, ord)
        join pg_attribute a on a.attrelid = ix.indrelid and a.attnum = k.attnum order by k.ord) as columns
      from pg_index ix join pg_class i on i.oid = ix.indexrelid where ix.indrelid = ${table}::regclass`,
  );
  const constraints = await rows<{ name: string; definition: string }>(
    db,
    sql`select conname as name, pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid = ${table}::regclass`,
  );
  return {
    columns: await postgresColumns(db, table),
    indexes: indexes.filter((index) => !index.primary),
    foreignKeys: constraints.flatMap((constraint) => parseForeignKey(constraint.definition)),
    constraints: constraints.map((constraint) => `${constraint.name}: ${constraint.definition}`),
  };
}

async function tableNames(db: Raw, dialect: TestDialect): Promise<string[]> {
  const names =
    dialect === 'sqlite'
      ? await rows<{ name: string }>(
          db,
          sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%'`,
        )
      : await rows<{ name: string }>(
          db,
          sql`select table_name as name from information_schema.tables
            where table_schema = 'public' and table_type = 'BASE TABLE'`,
        );
  return names
    .map((row) => row.name)
    .filter((name) => !name.startsWith('kysely_'))
    .sort();
}

const columnText = (column: Column): string =>
  [
    column.name,
    column.type,
    // SQLite lets a text primary key hold null where Postgres doesn't; ids are never null.
    column.primaryKey ? 'primary key' : column.notNull ? 'not null' : '',
    column.defaultValue === null ? '' : `default ${column.defaultValue}`,
  ]
    .filter(Boolean)
    .join(' ');

const indexText = (index: Index): string =>
  `${index.unique ? 'unique' : 'index'} (${index.columns.join(', ')})`;

const foreignKeyText = (key: ForeignKey): string =>
  `${key.column} -> ${key.table}.${key.references} on delete ${key.onDelete}`;

const portableTable = (table: RawTable): TableShape => ({
  columns: table.columns.map(columnText),
  indexes: table.indexes.map(indexText).sort(),
  foreignKeys: table.foreignKeys.map(foreignKeyText).sort(),
});

const exactTable = (table: RawTable): TableShape => ({
  columns: table.columns.map(columnText),
  indexes: [
    ...table.indexes.map((index) => `${index.name}: ${indexText(index)}`),
    ...table.constraints,
  ].sort(),
  foreignKeys: table.foreignKeys.map(foreignKeyText).sort(),
});

async function readTables(db: Db, dialect: TestDialect): Promise<Record<string, RawTable>> {
  const raw = db.withoutPlugins() as unknown as Raw;
  const tables: Record<string, RawTable> = {};
  for (const name of await tableNames(raw, dialect)) {
    tables[name] = await (dialect === 'sqlite' ? sqliteTable(raw, name) : postgresTable(raw, name));
  }
  return tables;
}

const mapTables = (
  tables: Record<string, RawTable>,
  shape: (table: RawTable) => TableShape,
): SchemaShape =>
  Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, shape(table)]));

export const exactSchema = async (db: Db, dialect: TestDialect): Promise<SchemaShape> =>
  mapTables(await readTables(db, dialect), exactTable);

export const portableSchema = async (db: Db, dialect: TestDialect): Promise<SchemaShape> =>
  mapTables(await readTables(db, dialect), portableTable);
