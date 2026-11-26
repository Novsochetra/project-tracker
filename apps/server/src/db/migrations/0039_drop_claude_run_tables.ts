import { sql, type Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Children first: on SQLite a DROP TABLE first deletes the table's rows, so each table goes once
// no table left points at it, and no cascade reaches one that stays (0038 took the links from
// questions and attachments).
const TABLES_IN_DROP_ORDER = [
  'run_steps',
  'run_requests',
  'run_changes',
  'ticket_viewed_files',
  'chat_card_tickets',
  'chat_queue',
  'chat_changes',
  'chat_git_actions',
  'runs',
  'chat_messages',
  'chats',
  'runners',
] as const;

const ACTIVE = sql<boolean>`status in ('queued', 'running')`;

// Ships only after PT-275's code, which uses none of them, is the release serving (§2.1).
export async function up(db: SchemaDb): Promise<void> {
  for (const table of TABLES_IN_DROP_ORDER) await db.schema.dropTable(table).execute();
}

async function createRunners(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('runners')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('project_ids', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('last_seen_at', 'bigint', (col) => col.notNull())
    .addColumn('tools', 'text')
    .addColumn('plan_limits', 'text')
    .execute();
  await db.schema.createIndex('runners_user_idx').on('runners').column('user_id').execute();
}

async function createChats(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('chats')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('project_id', 'text', (col) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('session_id', 'text')
    .addColumn('session_runner_id', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('updated_at', 'bigint', (col) => col.notNull())
    .addColumn('ask_model', 'text', (col) => col.notNull().defaultTo('default'))
    .addColumn('ask_mode', 'text', (col) => col.notNull().defaultTo('ask'))
    .addColumn('ask_effort', 'text', (col) => col.notNull().defaultTo('default'))
    .addColumn('ticket_id', 'text', (col) => col.references('tickets.id').onDelete('set null'))
    .execute();
  await db.schema
    .createIndex('chats_project_updated_idx')
    .on('chats')
    .columns(['project_id', 'updated_at'])
    .execute();
  await db.schema.createIndex('chats_ticket_idx').on('chats').column('ticket_id').execute();
}

async function createChatMessages(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('chat_messages')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('chat_id', 'text', (col) => col.notNull().references('chats.id').onDelete('cascade'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('ticket_id', 'text', (col) => col.references('tickets.id').onDelete('set null'))
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('run_id', 'text')
    .addColumn('batch_run_id', 'text')
    .execute();
  await db.schema
    .createIndex('chat_messages_chat_created_idx')
    .on('chat_messages')
    .columns(['chat_id', 'created_at'])
    .execute();
}

async function createRunsTable(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('runs')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('project_id', 'text', (col) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('ticket_id', 'text', (col) => col.references('tickets.id').onDelete('cascade'))
    .addColumn('runner_id', 'text', (col) => col.references('runners.id').onDelete('set null'))
    .addColumn('runner_name', 'text', (col) => col.notNull())
    .addColumn('prompt', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('started_at', 'bigint')
    .addColumn('ended_at', 'bigint')
    .addColumn('kind', 'text', (col) => col.notNull().defaultTo('ticket'))
    .addColumn('chat_id', 'text', (col) => col.references('chats.id').onDelete('cascade'))
    .addColumn('resume_session_id', 'text')
    .addColumn('ask_model', 'text')
    .addColumn('ask_mode', 'text')
    .addColumn('step_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('ask_effort', 'text')
    .addColumn('role', 'text')
    .addColumn('cost_micros', 'bigint')
    .addColumn('turns', 'integer')
    .addColumn('duration_ms', 'bigint')
    .addColumn('round', 'integer')
    .addColumn('chain_stop', 'text')
    .addColumn('question_id', 'text')
    .addColumn('batch_id', 'text')
    .addColumn('context_tokens', 'bigint')
    .addColumn('context_window', 'bigint')
    .addColumn('tokens', 'bigint')
    .execute();
}

async function createRunIndexes(db: SchemaDb): Promise<void> {
  const index = (name: string, columns: string[]) =>
    db.schema.createIndex(name).on('runs').columns(columns).execute();
  const oneActive = (name: string, column: string) =>
    db.schema.createIndex(name).on('runs').column(column).unique().where(ACTIVE).execute();
  await index('runs_runner_status_idx', ['runner_id', 'status']);
  await index('runs_status_created_idx', ['status', 'created_at']);
  await oneActive('runs_one_active_per_ticket', 'ticket_id');
  await oneActive('runs_one_active_per_chat', 'chat_id');
  await index('runs_chat_created_idx', ['chat_id', 'created_at']);
  await index('runs_project_ended_idx', ['project_id', 'ended_at']);
  await index('runs_batch_idx', ['batch_id']);
}

async function createRunChildren(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('run_steps')
    .addColumn('run_id', 'text', (col) => col.notNull().references('runs.id').onDelete('cascade'))
    .addColumn('seq', 'integer', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('sub_agent', 'integer', (col) => col.notNull())
    .addColumn('tool_id', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('todos', 'text')
    .addPrimaryKeyConstraint('run_steps_pk', ['run_id', 'seq'])
    .execute();
  await db.schema
    .createTable('run_requests')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('run_id', 'text', (col) => col.notNull().references('runs.id').onDelete('cascade'))
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('label_cut', 'integer', (col) => col.notNull())
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
  await db.schema
    .createIndex('run_requests_status_idx')
    .on('run_requests')
    .columns(['status', 'expires_at'])
    .execute();
}

async function createChanges(db: SchemaDb): Promise<void> {
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
    .createIndex('run_changes_ticket_created_idx')
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
}

async function createChatChildren(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('chat_card_tickets')
    .addColumn('message_id', 'text', (col) =>
      col.notNull().references('chat_messages.id').onDelete('cascade'),
    )
    .addColumn('card_index', 'integer', (col) => col.notNull())
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('chat_card_tickets_pk', ['message_id', 'card_index'])
    .execute();
  await db.schema
    .createIndex('chat_card_tickets_ticket_idx')
    .on('chat_card_tickets')
    .column('ticket_id')
    .execute();
  await db.schema
    .createTable('chat_queue')
    .addColumn('message_id', 'text', (col) =>
      col.primaryKey().references('chat_messages.id').onDelete('cascade'),
    )
    .addColumn('chat_id', 'text', (col) => col.notNull().references('chats.id').onDelete('cascade'))
    .addColumn('runner_id', 'text', (col) => col.notNull())
    .addColumn('ask_model', 'text', (col) => col.notNull())
    .addColumn('ask_mode', 'text', (col) => col.notNull())
    .addColumn('ask_effort', 'text', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.notNull())
    .addUniqueConstraint('chat_queue_position_key', ['chat_id', 'position'])
    .execute();
}

async function createChatGit(db: SchemaDb): Promise<void> {
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
    .createIndex('chat_git_actions_runner_idx')
    .on('chat_git_actions')
    .columns(['runner_id', 'status', 'created_at'])
    .execute();
  await db.schema
    .createIndex('chat_git_actions_chat_idx')
    .on('chat_git_actions')
    .columns(['chat_id', 'created_at'])
    .execute();
}

// The tables come back empty, as the last migration of each left them: their rows are only in a
// backup.
export async function down(db: SchemaDb): Promise<void> {
  await createRunners(db);
  await createChats(db);
  await createChatMessages(db);
  await createRunsTable(db);
  await createRunIndexes(db);
  await createRunChildren(db);
  await createChanges(db);
  await createChatChildren(db);
  await createChatGit(db);
}
