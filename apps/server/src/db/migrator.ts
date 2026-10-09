import { sql } from 'kysely';
import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import { MIGRATIONS } from './migrations';
import type { Db } from './schema';

export type Migrations = Readonly<Record<string, Migration>>;

export type MigrationStatus = 'applied' | 'pending' | 'unknown';

export interface MigrationState {
  name: string;
  status: MigrationStatus;
  appliedAt: string | null;
}

const MIGRATION_TABLE = 'kysely_migration';

// Migrations use explicit snake_case names, so they run without the camel-case plugin. Each run
// is one transaction (Postgres, and SQLite through TrackerSqliteDialect), and on Postgres Kysely
// holds an advisory lock around it, so a second deploy migrating at once waits and finds it done.
export const createMigrator = (db: Db, migrations: Migrations = MIGRATIONS): Migrator =>
  new Migrator({
    db: db.withoutPlugins(),
    provider: { getMigrations: () => Promise.resolve({ ...migrations }) },
  });

function namesOrThrow({ error, results = [] }: MigrationResultSet): string[] {
  if (error === undefined) {
    return results
      .filter((result) => result.status === 'Success')
      .map((result) => result.migrationName);
  }
  const failed = results.find((result) => result.status === 'Error')?.migrationName;
  const reason = error instanceof Error ? error.message : JSON.stringify(error);
  // The whole run is one transaction, so nothing of it is kept.
  const message = failed
    ? `Migration ${failed} failed, so none of this run was kept: ${reason}`
    : reason;
  throw new Error(message, { cause: error });
}

async function appliedRows(db: Db): Promise<{ name: string; timestamp: string }[]> {
  const tables = await db.introspection.getTables({ withInternalKyselyTables: true });
  if (!tables.some((table) => table.name === MIGRATION_TABLE)) return [];
  const { rows } = await sql<{ name: string; timestamp: string }>`
    select name, timestamp from ${sql.table(MIGRATION_TABLE)}`.execute(db.withoutPlugins());
  return rows;
}

// Known migrations in run order, then those the database has and this build doesn't (applied by a
// newer build).
export async function readMigrationState(
  db: Db,
  migrations: Migrations = MIGRATIONS,
): Promise<MigrationState[]> {
  const applied = new Map((await appliedRows(db)).map((row) => [row.name, row.timestamp]));
  const known = Object.keys(migrations).sort();
  const states = known.map((name): MigrationState => {
    const appliedAt = applied.get(name) ?? null;
    return { name, status: appliedAt === null ? 'pending' : 'applied', appliedAt };
  });
  const unknown = [...applied]
    .filter(([name]) => !(name in migrations))
    .sort(([a], [b]) => a.localeCompare(b));
  return [
    ...states,
    ...unknown.map(([name, appliedAt]): MigrationState => ({ name, status: 'unknown', appliedAt })),
  ];
}

export const namesWith = (states: readonly MigrationState[], status: MigrationStatus): string[] =>
  states.filter((state) => state.status === status).map((state) => state.name);

export function unknownMigrationsMessage(names: readonly string[]): string {
  return (
    `The database has migrations this build doesn't have: ${names.join(', ')}. ` +
    'Run the build that added them, or undo them with that build first (db:rollback).'
  );
}

async function assertNoUnknown(db: Db, migrations: Migrations): Promise<void> {
  const unknown = namesWith(await readMigrationState(db, migrations), 'unknown');
  if (unknown.length > 0) throw new Error(unknownMigrationsMessage(unknown));
}

// Runs every pending migration; says which ran.
export async function migrateToLatest(
  db: Db,
  migrations: Migrations = MIGRATIONS,
): Promise<string[]> {
  await assertNoUnknown(db, migrations);
  return namesOrThrow(await createMigrator(db, migrations).migrateToLatest());
}

// Undoes the last migration that ran; null when none has.
export async function rollbackLast(
  db: Db,
  migrations: Migrations = MIGRATIONS,
): Promise<string | null> {
  await assertNoUnknown(db, migrations);
  return namesOrThrow(await createMigrator(db, migrations).migrateDown())[0] ?? null;
}
