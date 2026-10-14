import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('projects')
    .addColumn('hide_name', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('projects').dropColumn('hide_name').execute();
}
