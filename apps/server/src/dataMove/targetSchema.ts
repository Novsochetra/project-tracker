import {
  migrateToLatest,
  namesWith,
  readMigrationState,
  unknownMigrationsMessage,
  type MigrationState,
} from '../db/migrator';
import type { Db } from '../db/schema';

export type SchemaVerdict = { problem: string } | { migrate: string[] };

// Rows go in only on this build's schema. The move migrates nothing but a database with no tables
// at all: one an older build serves would refuse that build's next start (it lacks the new
// migration), so it waits for this commit's deploy, whose pre-deploy step migrates it.
export function schemaVerdict(states: readonly MigrationState[], tables: number): SchemaVerdict {
  const unknown = namesWith(states, 'unknown');
  if (unknown.length > 0) return { problem: unknownMigrationsMessage(unknown) };
  const pending = namesWith(states, 'pending');
  if (namesWith(states, 'applied').length === 0) {
    if (tables === 0) return { migrate: pending };
    return {
      problem:
        'The target has tables but none of the tracker’s migrations, so it is not a tracker ' +
        'database. Check DATABASE_URL.',
    };
  }
  if (pending.length === 0) return { migrate: [] };
  return {
    problem:
      `The target is behind this build: it lacks ${pending.join(', ')}. Deploy this same commit ` +
      'first (its pre-deploy step migrates the database), then run the move again.',
  };
}

// Problems that stop the move; a dry run only says what it would migrate.
export async function prepareTargetSchema(
  db: Db,
  dryRun: boolean,
  say: (line: string) => void,
): Promise<string[]> {
  const tables = (await db.introspection.getTables()).length;
  const verdict = schemaVerdict(await readMigrationState(db), tables);
  if ('problem' in verdict) return [verdict.problem];
  if (verdict.migrate.length === 0) {
    say("The target's schema is up to date.");
  } else if (dryRun) {
    say(`Would migrate the empty target first: ${verdict.migrate.join(', ')}.`);
  } else {
    say(`Migrated the empty target: ${(await migrateToLatest(db)).join(', ')}.`);
  }
  return [];
}
