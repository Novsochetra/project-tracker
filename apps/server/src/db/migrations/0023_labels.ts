import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('labels')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('color', 'text', (col) => col.notNull())
    .addColumn('template', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('instructions', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema.createIndex('labels_project_idx').on('labels').column('project_id').execute();
  // Its own id like every other table, so the data move copies and checks it by id.
  await db.schema
    .createTable('ticket_labels')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addColumn('label_id', 'text', (col) =>
      col.notNull().references('labels.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addUniqueConstraint('ticket_labels_ticket_label_unique', ['ticket_id', 'label_id'])
    .execute();
  await db.schema
    .createIndex('ticket_labels_label_idx')
    .on('ticket_labels')
    .column('label_id')
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex('ticket_labels_label_idx').execute();
  await db.schema.dropTable('ticket_labels').execute();
  await db.schema.dropIndex('labels_project_idx').execute();
  await db.schema.dropTable('labels').execute();
}
