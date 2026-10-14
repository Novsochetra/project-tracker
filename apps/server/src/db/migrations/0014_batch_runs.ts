import { sql, type Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const BATCH_INDEX = 'runs_batch_idx';

// No foreign keys on these: a run and the batch that holds it are deleted with their project, and
// SQLite can't add one to a table that exists.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runs').addColumn('batch_id', 'text').execute();
  await db.schema.createIndex(BATCH_INDEX).on('runs').column('batch_id').execute();
  await db.schema.alterTable('chat_messages').addColumn('batch_run_id', 'text').execute();
}

// Older code would hand out a batch's ticket runs as runs of their own, with no prompt, and could
// not run the batch, so both end first.
export async function down(db: SchemaDb): Promise<void> {
  await sql`update runs set status = 'failed', error = 'The tracker was rolled back.'
    where status in ('queued', 'running') and (kind = 'batch' or batch_id is not null)`.execute(db);
  await db.schema.alterTable('chat_messages').dropColumn('batch_run_id').execute();
  await db.schema.dropIndex(BATCH_INDEX).execute();
  await db.schema.alterTable('runs').dropColumn('batch_id').execute();
}
