import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  // The default stands for projects made before there were instructions, and by older servers.
  await db.schema
    .alterTable('projects')
    .addColumn('instructions', 'text', (col) => col.notNull().defaultTo(''))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('projects').dropColumn('instructions').execute();
}
