import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Files list in the order they were picked, which uploads side by side don't arrive in. Files from
// before keep 0 and so stay in the order they arrived.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('attachments').dropColumn('position').execute();
}
