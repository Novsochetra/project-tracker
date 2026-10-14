import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('projects')
    .addColumn('max_parallel_runs', 'integer', (col) => col.notNull().defaultTo(5))
    .execute();
  // 0 or 1: neither database's boolean is portable.
  await db.schema
    .alterTable('tickets')
    .addColumn('needs_device', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('tickets').dropColumn('needs_device').execute();
  await db.schema.alterTable('projects').dropColumn('max_parallel_runs').execute();
}
