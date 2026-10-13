import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Null for helpers older than tools, which never send them.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runners').addColumn('tools', 'text').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runners').dropColumn('tools').execute();
}
