import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Null until a run of the helper's ends with Claude Code's word on the plan's limits.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runners').addColumn('plan_limits', 'text').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runners').dropColumn('plan_limits').execute();
}
