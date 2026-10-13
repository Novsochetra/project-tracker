import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const PROJECT_ENDED = 'runs_project_ended_idx';

const COLUMNS = [
  ['cost_micros', 'bigint'],
  ['turns', 'integer'],
  ['duration_ms', 'bigint'],
] as const;

// Nullable: runs that ended before helpers sent usage, and runs Claude never finished, have none.
// One column a statement, since SQLite adds only one at a time.
export async function up(db: SchemaDb): Promise<void> {
  for (const [column, type] of COLUMNS) {
    await db.schema.alterTable('runs').addColumn(column, type).execute();
  }
  // The project's last 30 days in the ••• sheet.
  await db.schema
    .createIndex(PROJECT_ENDED)
    .on('runs')
    .columns(['project_id', 'ended_at'])
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex(PROJECT_ENDED).execute();
  for (const [column] of [...COLUMNS].reverse()) {
    await db.schema.alterTable('runs').dropColumn(column).execute();
  }
}
