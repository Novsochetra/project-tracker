import { sql, type Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// An answer can hold several cards (PT-186), so each card links its own ticket. The old
// chat_messages.ticket_id stays for the release before this one; it is dropped in a later one.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('chat_card_tickets')
    .addColumn('message_id', 'text', (col) =>
      col.notNull().references('chat_messages.id').onDelete('cascade'),
    )
    .addColumn('card_index', 'integer', (col) => col.notNull())
    .addColumn('ticket_id', 'text', (col) =>
      col.notNull().references('tickets.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('chat_card_tickets_pk', ['message_id', 'card_index'])
    .execute();
  // Deleting a ticket looks up its links.
  await db.schema
    .createIndex('chat_card_tickets_ticket_idx')
    .on('chat_card_tickets')
    .column('ticket_id')
    .execute();
  // A message had one card until now, so its ticket is its first card's.
  await sql`insert into chat_card_tickets (message_id, card_index, ticket_id)
    select id, 0, ticket_id from chat_messages where ticket_id is not null`.execute(db);
}

// Only a first card's ticket fits the old column; the others stay as tickets without a link.
export async function down(db: SchemaDb): Promise<void> {
  await sql`update chat_messages set ticket_id = (
      select ticket_id from chat_card_tickets
      where chat_card_tickets.message_id = chat_messages.id and card_index = 0
    )
    where id in (select message_id from chat_card_tickets where card_index = 0)`.execute(db);
  await db.schema.dropIndex('chat_card_tickets_ticket_idx').execute();
  await db.schema.dropTable('chat_card_tickets').execute();
}
