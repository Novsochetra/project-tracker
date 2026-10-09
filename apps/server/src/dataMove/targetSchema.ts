import {
  migrateToLatest,
  namesWith,
  readMigrationState,
  unknownMigrationsMessage,
} from '../db/migrator';
import type { Db } from '../db/schema';

// Rows go in only on this build's schema. After the first deploy the pre-deploy step has already
// migrated it, so this normally applies nothing. A database a newer build migrated is refused.
export async function migrateTarget(db: Db, say: (line: string) => void): Promise<void> {
  const applied = await migrateToLatest(db);
  say(
    applied.length > 0
      ? `Migrated the target: ${applied.join(', ')}.`
      : "The target's schema is up to date.",
  );
}

// A dry run only says what migrating would do.
export async function describeTargetSchema(db: Db, say: (line: string) => void): Promise<string[]> {
  const states = await readMigrationState(db);
  const unknown = namesWith(states, 'unknown');
  if (unknown.length > 0) return [unknownMigrationsMessage(unknown)];
  const pending = namesWith(states, 'pending');
  say(
    pending.length > 0
      ? `Would migrate the target first: ${pending.join(', ')}.`
      : "The target's schema is up to date.",
  );
  return [];
}
