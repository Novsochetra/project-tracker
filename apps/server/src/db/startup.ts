import { isPostgresUrl } from './createDatabase';
import { MIGRATIONS } from './migrations';
import {
  migrateToLatest,
  namesWith,
  readMigrationState,
  unknownMigrationsMessage,
  type Migrations,
} from './migrator';
import type { Db } from './schema';

// A SQLite file belongs to the one server process using it, so that process migrates it. Postgres
// is migrated by the deploy's pre-deploy command before the new server starts: a migration that
// fails stops the deploy while the old server keeps serving, where one at start would crash-loop
// the new server instead. MIGRATE_ON_START=1 or 0 overrides either.
export function migratesOnStart(url: string, env: NodeJS.ProcessEnv): boolean {
  if (env.MIGRATE_ON_START === '1') return true;
  if (env.MIGRATE_ON_START === '0') return false;
  return !isPostgresUrl(url);
}

// Migrates, or checks the database is at exactly this build's migrations: a server never runs on a
// schema it wasn't built for. Says which migrations ran.
export async function prepareDatabase(
  db: Db,
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  migrations: Migrations = MIGRATIONS,
): Promise<string[]> {
  if (migratesOnStart(url, env)) return migrateToLatest(db, migrations);
  const states = await readMigrationState(db, migrations);
  const unknown = namesWith(states, 'unknown');
  if (unknown.length > 0) throw new Error(unknownMigrationsMessage(unknown));
  const pending = namesWith(states, 'pending');
  if (pending.length > 0) {
    throw new Error(
      `The database is missing migrations this build needs: ${pending.join(', ')}. ` +
        'Run db:migrate first (the pre-deploy command), or start with MIGRATE_ON_START=1.',
    );
  }
  return [];
}
