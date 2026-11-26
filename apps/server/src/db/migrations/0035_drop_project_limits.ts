import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Ships only after PT-253's release, which no longer reads them, is the one serving (§2.1).
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('projects').dropColumn('max_parallel_runs').execute();
  await db.schema.alterTable('projects').dropColumn('max_sub_agents').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('projects')
    .addColumn('max_parallel_runs', 'integer', (col) => col.notNull().defaultTo(5))
    .execute();
  await db.schema
    .alterTable('projects')
    .addColumn('max_sub_agents', 'integer', (col) => col.notNull().defaultTo(3))
    .execute();
}
