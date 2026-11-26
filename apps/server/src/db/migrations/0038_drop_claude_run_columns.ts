import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const LINE_COLUMNS = [
  ['line_run_id', 'text'],
  ['line_path', 'text'],
  ['line_side', 'text'],
  ['line_number', 'integer'],
] as const;

// Before 0039 drops the tables these point at: on SQLite a DROP TABLE first deletes the table's
// rows, which would cascade to every attachment still linked to a chat message, and a foreign key
// to a table that is gone refuses every new question. A dropped column keeps its table, so no
// table others reference is rebuilt (§2.1). Ships only after PT-275's code, which reads none of
// them, is the release serving.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex('attachments_chat_message_idx').execute();
  await db.schema.alterTable('attachments').dropColumn('chat_message_id').execute();
  await db.schema.alterTable('questions').dropColumn('run_id').execute();
  // One column a statement, since SQLite drops only one at a time.
  for (const [column] of LINE_COLUMNS) {
    await db.schema.alterTable('activities').dropColumn(column).execute();
  }

  await db.schema.alterTable('projects').dropColumn('auto_review').execute();
  await db.schema.alterTable('tickets').dropColumn('needs_device').execute();
}

// They come back empty, at the end of their tables: what up() dropped is only in a backup.
export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('projects').addColumn('auto_review', 'integer').execute();
  await db.schema
    .alterTable('tickets')
    .addColumn('needs_device', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
  for (const [column, type] of LINE_COLUMNS) {
    await db.schema.alterTable('activities').addColumn(column, type).execute();
  }

  await db.schema
    .alterTable('questions')
    .addColumn('run_id', 'text', (col) => col.references('runs.id').onDelete('set null'))
    .execute();
  await db.schema
    .alterTable('attachments')
    .addColumn('chat_message_id', 'text', (col) =>
      col.references('chat_messages.id').onDelete('cascade'),
    )
    .execute();
  await db.schema
    .createIndex('attachments_chat_message_idx')
    .on('attachments')
    .column('chat_message_id')
    .execute();
}
