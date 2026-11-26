import { sql, type Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// A chat's delete cascades to the files linked to its messages, and takes their rows with it, so
// their stored files would stay with nothing naming them. Unlinked, a file sent in a chat is a
// pending upload, which the start-up clean-up removes, row and stored file, once it is a day old.
export async function up(db: SchemaDb): Promise<void> {
  await sql`update attachments set chat_message_id = null
    where chat_message_id is not null`.execute(db);
}

// The links can't come back: no copy of which message sent each file is kept.
export function down(): Promise<void> {
  return Promise.resolve();
}
