import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const RUNNER_QUEUE = 'chat_git_actions_runner_idx';
const CHAT_CREATED = 'chat_git_actions_chat_idx';

// What an Edit or Auto chat changed on its helper (PT-237), and the commits and pull requests the
// person asks that helper for. Files are JSON as text, like runners.project_ids (§2).
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('chat_changes')
    .addColumn('chat_id', 'text', (col) =>
      col.primaryKey().references('chats.id').onDelete('cascade'),
    )
    .addColumn('version', 'text', (col) => col.notNull())
    .addColumn('runner_id', 'text', (col) => col.notNull())
    .addColumn('tree', 'text', (col) => col.notNull())
    .addColumn('diff', 'text', (col) => col.notNull())
    .addColumn('cut', 'integer', (col) => col.notNull())
    .addColumn('files', 'text', (col) => col.notNull())
    .addColumn('branch', 'text')
    .addColumn('default_branch', 'text')
    .addColumn('gh_ready', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema
    .createTable('chat_git_actions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('chat_id', 'text', (col) => col.notNull().references('chats.id').onDelete('cascade'))
    .addColumn('runner_id', 'text', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('input', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('result', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('ended_at', 'bigint')
    .execute();
  await db.schema
    .createIndex(RUNNER_QUEUE)
    .on('chat_git_actions')
    .columns(['runner_id', 'status', 'created_at'])
    .execute();
  await db.schema
    .createIndex(CHAT_CREATED)
    .on('chat_git_actions')
    .columns(['chat_id', 'created_at'])
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex(CHAT_CREATED).execute();
  await db.schema.dropIndex(RUNNER_QUEUE).execute();
  await db.schema.dropTable('chat_git_actions').execute();
  await db.schema.dropTable('chat_changes').execute();
}
