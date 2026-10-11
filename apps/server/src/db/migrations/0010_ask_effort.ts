import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

export async function up(db: SchemaDb): Promise<void> {
  // Null on ticket runs and on questions queued before there was an effort.
  await db.schema.alterTable('runs').addColumn('ask_effort', 'text').execute();
  // A chat keeps the last choice; the default stands for chats made before there was one.
  await db.schema
    .alterTable('chats')
    .addColumn('ask_effort', 'text', (col) => col.notNull().defaultTo('default'))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runs').dropColumn('ask_effort').execute();
  await db.schema.alterTable('chats').dropColumn('ask_effort').execute();
}
