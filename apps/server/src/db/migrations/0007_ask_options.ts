import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const COLUMNS = ['ask_model', 'ask_mode'] as const;

// SQLite takes one column per alter table, so each goes on its own.
export async function up(db: SchemaDb): Promise<void> {
  // A run keeps the question's choice, since an Edit question waits in the ticket lane; null on
  // ticket runs.
  for (const column of COLUMNS) {
    await db.schema.alterTable('runs').addColumn(column, 'text').execute();
  }
  // A chat keeps the last choice; the defaults stand for chats made before there was one.
  await db.schema
    .alterTable('chats')
    .addColumn('ask_model', 'text', (col) => col.notNull().defaultTo('default'))
    .execute();
  await db.schema
    .alterTable('chats')
    .addColumn('ask_mode', 'text', (col) => col.notNull().defaultTo('ask'))
    .execute();
}

export async function down(db: SchemaDb): Promise<void> {
  for (const table of ['runs', 'chats']) {
    for (const column of COLUMNS) {
      await db.schema.alterTable(table).dropColumn(column).execute();
    }
  }
}
