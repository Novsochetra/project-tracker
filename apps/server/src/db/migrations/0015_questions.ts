import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('questions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('run_id', 'text', (col) => col.references('runs.id').onDelete('set null'))
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('choices', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('answer', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('expires_at', 'bigint', (col) => col.notNull())
    .addColumn('ended_at', 'bigint')
    .execute();
  await db.schema
    .createIndex('questions_ticket_idx')
    .on('questions')
    .columns(['ticket_id', 'created_at'])
    .execute();
  // Every question route first ends the open questions that are overdue or whose run ended.
  await db.schema
    .createIndex('questions_status_idx')
    .on('questions')
    .columns(['status', 'expires_at'])
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex('questions_status_idx').execute();
  await db.schema.dropIndex('questions_ticket_idx').execute();
  await db.schema.dropTable('questions').execute();
}
