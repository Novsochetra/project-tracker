import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const INDEX = 'tickets_project_client_id_unique';

// Null for tickets made before client ids and for creates without one; unique indexes let nulls
// repeat in SQLite and Postgres alike.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('tickets').addColumn('client_id', 'text').execute();
  await db.schema
    .createIndex(INDEX)
    .on('tickets')
    .columns(['project_id', 'client_id'])
    .unique()
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex(INDEX).execute();
  await db.schema.alterTable('tickets').dropColumn('client_id').execute();
}
