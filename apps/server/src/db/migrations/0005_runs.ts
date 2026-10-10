import { sql, type Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const ONE_ACTIVE_RUN = 'runs_one_active_per_ticket';

async function createRunners(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('runners')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('project_ids', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('last_seen_at', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema.createIndex('runners_user_idx').on('runners').column('user_id').execute();
}

export async function createRuns(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('runs')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('project_id', 'text', (col) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('runner_id', 'text', (col) => col.references('runners.id').onDelete('set null'))
    .addColumn('runner_name', 'text', (col) => col.notNull())
    .addColumn('prompt', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('started_at', 'bigint')
    .addColumn('ended_at', 'bigint')
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
  // One Claude at a time on a ticket, even when two taps race: the second insert fails.
  await db.schema
    .createIndex(ONE_ACTIVE_RUN)
    .on('runs')
    .column('ticket_id')
    .unique()
    .where(sql<boolean>`status in ('queued', 'running')`)
    .execute();
}

export async function up(db: SchemaDb): Promise<void> {
  await createRunners(db);
  await createRuns(db);
}

export async function down(db: SchemaDb): Promise<void> {
  for (const table of ['runs', 'runners']) {
    await db.schema.dropTable(table).execute();
  }
}
