import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const TICKET_CREATED = 'run_changes_ticket_created_idx';

const LINE_COLUMNS = [
  ['line_run_id', 'text'],
  ['line_path', 'text'],
  ['line_side', 'text'],
  ['line_number', 'integer'],
] as const;

// What a ticket run changed in its folder (PT-229), the files a person ticked as viewed, and the
// line a comment is on. A line comment keeps its run without a foreign key: SQLite can't add one
// to a table that exists, and the comment outlives the run's changes. One column a statement,
// since SQLite adds only one at a time.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('run_changes')
    .addColumn('run_id', 'text', (col) =>
      col.primaryKey().references('runs.id').onDelete('cascade'),
    )
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('diff', 'text', (col) => col.notNull())
    .addColumn('cut', 'integer', (col) => col.notNull())
    .addColumn('verdict', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex(TICKET_CREATED)
    .on('run_changes')
    .columns(['ticket_id', 'created_at'])
    .execute();
  await db.schema
    .createTable('ticket_viewed_files')
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('digest', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addPrimaryKeyConstraint('ticket_viewed_files_pk', ['ticket_id', 'path'])
    .execute();
  for (const [column, type] of LINE_COLUMNS) {
    await db.schema.alterTable('activities').addColumn(column, type).execute();
  }
}

export async function down(db: SchemaDb): Promise<void> {
  for (const [column] of [...LINE_COLUMNS].reverse()) {
    await db.schema.alterTable('activities').dropColumn(column).execute();
  }
  await db.schema.dropTable('ticket_viewed_files').execute();
  await db.schema.dropIndex(TICKET_CREATED).execute();
  await db.schema.dropTable('run_changes').execute();
}
