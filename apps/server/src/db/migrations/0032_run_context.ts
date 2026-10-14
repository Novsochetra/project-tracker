import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

const COLUMNS = ['context_tokens', 'context_window', 'tokens'] as const;

// Nullable: helpers from before PT-239 send none. One column a statement, since SQLite adds only
// one at a time.
export async function up(db: SchemaDb): Promise<void> {
  for (const column of COLUMNS) {
    await db.schema.alterTable('runs').addColumn(column, 'bigint').execute();
  }
}

export async function down(db: SchemaDb): Promise<void> {
  for (const column of [...COLUMNS].reverse()) {
    await db.schema.alterTable('runs').dropColumn(column).execute();
  }
}
