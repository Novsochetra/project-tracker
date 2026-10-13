import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Null on runs queued before there were roles: they were all work runs.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runs').addColumn('role', 'text').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runs').dropColumn('role').execute();
}
