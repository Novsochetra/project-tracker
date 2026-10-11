import { sql, type Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// A reset link is an invite for an account that exists, so it shares the invites table and code.
// No foreign key on user_id: SQLite can't drop a column that has one, and down() must.
export async function up(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('invites')
    .addColumn('kind', 'text', (col) => col.notNull().defaultTo('invite'))
    .execute();
  await db.schema.alterTable('invites').addColumn('user_id', 'text').execute();
  // One open link per account: on Postgres two creates at once could otherwise both insert.
  await db.schema
    .createIndex('invites_open_reset_unique')
    .on('invites')
    .column('user_id')
    .unique()
    .where(sql.raw<boolean>("kind = 'reset' and used_at is null"))
    .execute();
}

// Without the kind, a reset link left over would work as an invite.
export async function down(db: SchemaDb): Promise<void> {
  await sql`delete from invites where kind = 'reset'`.execute(db);
  await db.schema.dropIndex('invites_open_reset_unique').execute();
  await db.schema.alterTable('invites').dropColumn('user_id').execute();
  await db.schema.alterTable('invites').dropColumn('kind').execute();
}
