import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// The ticket a chat is about. Deleting the ticket keeps the chat, so the link goes null.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('chats')
    .addColumn('ticket_id', 'text', (col) => col.references('tickets.id').onDelete('set null'))
    .execute();
  await db.schema.createIndex('chats_ticket_idx').on('chats').column('ticket_id').execute();
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropIndex('chats_ticket_idx').execute();
  await db.schema.alterTable('chats').dropColumn('ticket_id').execute();
}
