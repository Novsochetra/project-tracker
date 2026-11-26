import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// The API token that asked, so only it can cancel the question. No foreign key: revoking a token
// leaves its questions as they are. Questions asked before this, or with no token, keep null.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('questions').addColumn('asked_by_token_id', 'text').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('questions').dropColumn('asked_by_token_id').execute();
}
