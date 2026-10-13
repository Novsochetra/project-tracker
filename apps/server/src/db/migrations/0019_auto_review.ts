import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// All nullable, so a tracker that rolls back past this keeps working: a project without the
// setting is off, a run without a round is one a person started, and no stop means none.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('projects').addColumn('auto_review', 'integer').execute();
  await db.schema.alterTable('runs').addColumn('round', 'integer').execute();
  await db.schema.alterTable('runs').addColumn('chain_stop', 'text').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runs').dropColumn('chain_stop').execute();
  await db.schema.alterTable('runs').dropColumn('round').execute();
  await db.schema.alterTable('projects').dropColumn('auto_review').execute();
}
