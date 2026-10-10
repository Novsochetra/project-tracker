import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('run_requests')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('run_id', 'text', (col) => col.notNull().references('runs.id').onDelete('cascade'))
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('questions', 'text')
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('decision', 'text')
    .addColumn('answers', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('expires_at', 'bigint', (col) => col.notNull())
    .addColumn('ended_at', 'bigint')
    .execute();
  await db.schema
    .createIndex('run_requests_run_idx')
    .on('run_requests')
    .columns(['run_id', 'created_at'])
    .execute();
  // Every request route first ends the open requests that are overdue or whose run ended.
  await db.schema
    .createIndex('run_requests_status_idx')
    .on('run_requests')
    .columns(['status', 'expires_at'])
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex('run_requests_status_idx').execute();
  await db.schema.dropIndex('run_requests_run_idx').execute();
  await db.schema.dropTable('run_requests').execute();
}
