import { sql, type Kysely } from 'kysely';
import { createRuns } from './0005_runs';

type SchemaDb = Kysely<unknown>;

const KEPT = 'runs_kept';
const RUN_COLUMNS = sql.raw(
  'id, user_id, project_id, ticket_id, runner_id, runner_name, prompt, status, error, created_at, started_at, ended_at',
);

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
    .execute();
  await db.schema
    .createIndex('chats_project_updated_idx')
    .on('chats')
    .columns(['project_id', 'updated_at'])
    .execute();
  await db.schema
    .createTable('chat_messages')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('chat_id', 'text', (col) => col.notNull().references('chats.id').onDelete('cascade'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('ticket_id', 'text', (col) => col.references('tickets.id').onDelete('set null'))
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex('chat_messages_chat_created_idx')
    .on('chat_messages')
    .columns(['chat_id', 'created_at'])
    .execute();
}

async function createRunsWithAsks(db: SchemaDb): Promise<void> {
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
    .execute();
  await db.schema
    .createIndex('runs_runner_status_idx')
    .on('runs')
    .columns(['runner_id', 'status'])
    .execute();
  await db.schema
    .createIndex('runs_status_created_idx')
    .on('runs')
    .columns(['status', 'created_at'])
    .execute();
  await db.schema
    .createIndex('runs_one_active_per_ticket')
    .on('runs')
    .column('ticket_id')
    .unique()
    .where(sql<boolean>`status in ('queued', 'running')`)
    .execute();
  // One question at a time in a chat, even when two sends race.
  await db.schema
    .createIndex('runs_one_active_per_chat')
    .on('runs')
    .column('chat_id')
    .unique()
    .where(sql<boolean>`status in ('queued', 'running')`)
    .execute();
}

// SQLite can't drop a column's not null, so runs is made again. Through a plain copy rather than a
// rename, so the table, its indexes and Postgres' constraints keep their names both ways.
async function remakeRuns(db: SchemaDb, create: (db: SchemaDb) => Promise<void>): Promise<void> {
  await sql`create table ${sql.table(KEPT)} as select ${RUN_COLUMNS} from runs`.execute(db);
  await db.schema.dropTable('runs').execute();
  await create(db);
  await sql`insert into runs (${RUN_COLUMNS}) select ${RUN_COLUMNS} from ${sql.table(KEPT)}`.execute(
    db,
  );
  await db.schema.dropTable(KEPT).execute();
}

export async function up(db: SchemaDb): Promise<void> {
  await createChats(db);
  await remakeRuns(db, createRunsWithAsks);
}

export async function down(db: SchemaDb): Promise<void> {
  await sql`delete from runs where kind = 'ask'`.execute(db);
  await remakeRuns(db, createRuns);
  await db.schema.dropTable('chat_messages').execute();
  await db.schema.dropTable('chats').execute();
}
