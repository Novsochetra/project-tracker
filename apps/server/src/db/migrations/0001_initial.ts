import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

async function createProjects(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('key', 'text', (col) => col.notNull().unique())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('repo', 'text', (col) => col.notNull())
    .addColumn('color', 'text', (col) => col.notNull())
    .addColumn('next_num', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('updated_at', 'bigint', (col) => col.notNull())
    .execute();
}

async function createStatuses(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('statuses')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('category', 'text', (col) => col.notNull())
    .addColumn('color', 'text', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
}

async function createTickets(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('tickets')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('num', 'integer', (col) => col.notNull())
    .addColumn('status_id', 'text', (col) =>
      col.notNull().references('statuses.id').onDelete('restrict'),
    )
    .addColumn('rank', 'integer', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('priority', 'text', (col) => col.notNull())
    .addColumn('assignee', 'text', (col) => col.notNull())
    .addColumn('due', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('updated_at', 'bigint', (col) => col.notNull())
    .addUniqueConstraint('tickets_project_num_unique', ['project_id', 'num'])
    .execute();
}

async function createActivities(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('activities')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('actor_kind', 'text', (col) => col.notNull())
    .addColumn('actor_name', 'text', (col) => col.notNull())
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('review_verdict', 'text')
    .addColumn('review_rating', 'integer')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('edited_at', 'bigint')
    .execute();
}

async function createAttachments(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('attachments')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('ticket_id', 'text', (col) => col.references('tickets.id').onDelete('cascade'))
    .addColumn('activity_id', 'text', (col) => col.references('activities.id').onDelete('cascade'))
    .addColumn('file_name', 'text', (col) => col.notNull())
    .addColumn('mime_type', 'text', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('storage_key', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
}

const INDEXES: readonly (readonly [string, string, readonly string[]])[] = [
  ['tickets_project_status_rank_idx', 'tickets', ['project_id', 'status_id', 'rank']],
  ['activities_ticket_created_idx', 'activities', ['ticket_id', 'created_at']],
  ['attachments_ticket_idx', 'attachments', ['ticket_id']],
  ['attachments_activity_idx', 'attachments', ['activity_id']],
  ['statuses_project_position_idx', 'statuses', ['project_id', 'position']],
];

async function createIndexes(db: SchemaDb): Promise<void> {
  for (const [name, table, columns] of INDEXES) {
    await db.schema
      .createIndex(name)
      .on(table)
      .columns([...columns])
      .execute();
  }
}

export async function up(db: SchemaDb): Promise<void> {
  await createProjects(db);
  await createStatuses(db);
  await createTickets(db);
  await createActivities(db);
  await createAttachments(db);
  await createIndexes(db);
}

export async function down(db: SchemaDb): Promise<void> {
  for (const table of ['attachments', 'activities', 'tickets', 'statuses', 'projects']) {
    await db.schema.dropTable(table).execute();
  }
}
