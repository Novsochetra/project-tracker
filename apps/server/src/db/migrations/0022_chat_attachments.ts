import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Files sent with a chat question (PT-187) belong to the person's message and go with it. The run
// names that message, so the helper is given the files of the question it answers.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('attachments')
    .addColumn('chat_message_id', 'text', (col) =>
      col.references('chat_messages.id').onDelete('cascade'),
    )
    .execute();
  await db.schema
    .createIndex('attachments_chat_message_idx')
    .on('attachments')
    .column('chat_message_id')
    .execute();
  await db.schema.alterTable('runs').addColumn('question_id', 'text').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.alterTable('runs').dropColumn('question_id').execute();
  await db.schema.dropIndex('attachments_chat_message_idx').execute();
  await db.schema.alterTable('attachments').dropColumn('chat_message_id').execute();
}
