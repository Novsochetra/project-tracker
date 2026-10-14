import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// A message sent while Claude answers waits here (PT-234). It is a chat message already, so its
// files stay linked; it leaves the queue when its own run starts.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('chat_queue')
    .addColumn('message_id', 'text', (col) =>
      col.primaryKey().references('chat_messages.id').onDelete('cascade'),
    )
    .addColumn('chat_id', 'text', (col) => col.notNull().references('chats.id').onDelete('cascade'))
    .addColumn('runner_id', 'text', (col) => col.notNull())
    .addColumn('ask_model', 'text', (col) => col.notNull())
    .addColumn('ask_mode', 'text', (col) => col.notNull())
    .addColumn('ask_effort', 'text', (col) => col.notNull())
    .execute();
  await db.schema.createIndex('chat_queue_chat_idx').on('chat_queue').column('chat_id').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex('chat_queue_chat_idx').execute();
  await db.schema.dropTable('chat_queue').execute();
}
