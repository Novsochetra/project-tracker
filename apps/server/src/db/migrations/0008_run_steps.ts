import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  // Steps are counted on the run, so adding them takes the run's row: one add waits for another,
  // and none lands once the run's end has been written.
  await db.schema
    .alterTable('runs')
    .addColumn('step_count', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
  await db.schema
    .createTable('run_steps')
    .addColumn('run_id', 'text', (col) => col.notNull().references('runs.id').onDelete('cascade'))
    .addColumn('seq', 'integer', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('sub_agent', 'integer', (col) => col.notNull())
    .addColumn('tool_id', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addPrimaryKeyConstraint('run_steps_pk', ['run_id', 'seq'])
    .execute();
  // Claude's answer keeps the run that gave it, so its steps can fold under it. No foreign key:
  // SQLite can't drop a column that has one, and an ask run goes only with its chat.
  await db.schema.alterTable('chat_messages').addColumn('run_id', 'text').execute();
  // A chat reads its latest ask and its stopped ones on every look; without this, both walked the
  // runs of every chat by status.
  await db.schema
    .createIndex('runs_chat_created_idx')
    .on('runs')
    .columns(['chat_id', 'created_at'])
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex('runs_chat_created_idx').execute();
  await db.schema.alterTable('chat_messages').dropColumn('run_id').execute();
  await db.schema.dropTable('run_steps').execute();
  await db.schema.alterTable('runs').dropColumn('step_count').execute();
}
