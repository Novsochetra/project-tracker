import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('run_steps').addColumn('todos', 'text').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('run_steps').dropColumn('todos').execute();
}
