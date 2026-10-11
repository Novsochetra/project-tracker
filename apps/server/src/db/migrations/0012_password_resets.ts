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
}

// Without the kind, a reset link left over would work as an invite.
export async function down(db: SchemaDb): Promise<void> {
  await sql`delete from invites where kind = 'reset'`.execute(db);
  await db.schema.alterTable('invites').dropColumn('user_id').execute();
  await db.schema.alterTable('invites').dropColumn('kind').execute();
}
