import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('projects')
    .addColumn('max_sub_agents', 'integer', (col) => col.notNull().defaultTo(3))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('projects').dropColumn('max_sub_agents').execute();
}
