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

interface PostgresRow {
  table: string;
}

// One catalog query per kind for every table, straight from pg_catalog: information_schema's views
// and a query per table made each read take dozens of slow round trips through PGlite.
const PUBLIC_TABLES = sql`select c.oid, c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'`;

const postgresColumnRows = (db: Raw) =>
  rows<
    PostgresRow & {
      name: string;
      type: string;
      notNull: boolean;
      primary: boolean;
      dflt: string | null;
    }
  >(
    db,
    sql`select t.relname as "table", a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
      a.attnotnull as "notNull", pg_get_expr(d.adbin, d.adrelid) as dflt,
      exists (select 1 from pg_index i where i.indrelid = t.oid and i.indisprimary
        and a.attnum = any(i.indkey)) as "primary"
      from (${PUBLIC_TABLES}) t join pg_attribute a on a.attrelid = t.oid
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attnum > 0 and not a.attisdropped order by t.relname, a.attnum`,
  );

const postgresIndexRows = (db: Raw) =>
  rows<PostgresRow & { name: string; unique: boolean; primary: boolean; columns: string[] }>(
    db,
    sql`select t.relname as "table", i.relname as name, ix.indisunique as unique,
      ix.indisprimary as primary,
      array(select a.attname::text from unnest(ix.indkey::int2[]) with ordinality as k(attnum, ord)
        join pg_attribute a on a.attrelid = ix.indrelid and a.attnum = k.attnum order by k.ord) as columns
      from (${PUBLIC_TABLES}) t join pg_index ix on ix.indrelid = t.oid
      join pg_class i on i.oid = ix.indexrelid`,
  );

const postgresConstraintRows = (db: Raw) =>
  rows<PostgresRow & { name: string; definition: string }>(
    db,
    sql`select t.relname as "table", c.conname as name, pg_get_constraintdef(c.oid) as definition
      from (${PUBLIC_TABLES}) t join pg_constraint c on c.conrelid = t.oid`,
  );

const ofTable = <T extends PostgresRow>(all: T[], table: string): T[] =>
  all.filter((row) => row.table === table);

async function postgresTables(db: Raw, names: string[]): Promise<Record<string, RawTable>> {
  const [columns, indexes, constraints] = await Promise.all([
    postgresColumnRows(db),
    postgresIndexRows(db),
    postgresConstraintRows(db),
  ]);
  const tables: Record<string, RawTable> = {};
  for (const name of names) {
    const own = ofTable(constraints, name);
    tables[name] = {
      columns: ofTable(columns, name).map((column) => ({
        name: column.name,
        type: column.type,
        notNull: column.notNull,
        primaryKey: column.primary,
        defaultValue: column.dflt?.replace(/::[\w ]+$/, '') ?? null,
      })),
      indexes: ofTable(indexes, name).filter((index) => !index.primary),
      foreignKeys: own.flatMap((constraint) => parseForeignKey(constraint.definition)),
      constraints: own.map((constraint) => `${constraint.name}: ${constraint.definition}`),
    };
  }
  return tables;
}

async function tableNames(db: Raw, dialect: TestDialect): Promise<string[]> {
  const names =
    dialect === 'sqlite'
      ? await rows<{ name: string }>(
          db,
          sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%'`,
        )
      : await rows<{ name: string }>(db, sql`select relname as name from (${PUBLIC_TABLES}) t`);
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
  const names = await tableNames(raw, dialect);
  if (dialect === 'pglite') return postgresTables(raw, names);
  const tables: Record<string, RawTable> = {};
  for (const name of names) tables[name] = await sqliteTable(raw, name);
  return tables;
}

const mapTables = (
  tables: Record<string, RawTable>,
  shape: (table: RawTable) => TableShape,
): SchemaShape =>
  Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, shape(table)]));

export interface SchemaShapes {
  exact: SchemaShape;
  portable: SchemaShape;
}

// Both shapes from one read, for a test that needs both of the same state.
export async function readSchema(db: Db, dialect: TestDialect): Promise<SchemaShapes> {
  const tables = await readTables(db, dialect);
  return { exact: mapTables(tables, exactTable), portable: mapTables(tables, portableTable) };
}

export const exactSchema = async (db: Db, dialect: TestDialect): Promise<SchemaShape> =>
  (await readSchema(db, dialect)).exact;

export const portableSchema = async (db: Db, dialect: TestDialect): Promise<SchemaShape> =>
  (await readSchema(db, dialect)).portable;
