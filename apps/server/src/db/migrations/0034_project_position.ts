import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Every project starts at 0, so until someone reorders them they keep their creation order: the
// list sorts by position and then by created_at, which is all the release before this one reads.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('projects')
    .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('projects').dropColumn('position').execute();
}
