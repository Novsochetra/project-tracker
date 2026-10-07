import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import * as initial from './migrations/0001_initial';
import type { Db } from './schema';

const MIGRATIONS: Record<string, Migration> = {
  '0001_initial': initial,
};

const provider: MigrationProvider = {
  getMigrations: () => Promise.resolve(MIGRATIONS),
};

export async function migrateToLatest(db: Db): Promise<void> {
  // Migrations use explicit snake_case names, so they run without the camel-case plugin.
  const migrator = new Migrator({ db: db.withoutPlugins(), provider });
  const { error } = await migrator.migrateToLatest();
  if (error)
    throw error instanceof Error ? error : new Error('Migration failed.', { cause: error });
}
