import { sql, type Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// No foreign keys on the added columns: SQLite can't drop a column that has one, and down() must.
async function addColumns(db: SchemaDb): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('name', 'text', (col) => col.notNull().defaultTo(''))
    .execute();
  await db.schema
    .alterTable('users')
    .addColumn('role', 'text', (col) => col.notNull().defaultTo('user'))
    .execute();
  // Null only on a tracker without an owner yet; owner-set then gives them to the owner.
  await db.schema.alterTable('projects').addColumn('owner_id', 'text').execute();
  await db.schema.createIndex('projects_owner_idx').on('projects').column('owner_id').execute();
  // Who uploaded a file, so one on no ticket yet is only theirs to read or attach.
  await db.schema.alterTable('attachments').addColumn('user_id', 'text').execute();
}

async function createInvites(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('invites')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('token_hash', 'text', (col) => col.notNull())
    .addColumn('created_by', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('expires_at', 'bigint', (col) => col.notNull())
    .addColumn('used_at', 'bigint')
    .addColumn('used_by', 'text', (col) => col.references('users.id').onDelete('set null'))
    .addUniqueConstraint('invites_token_hash_unique', ['token_hash'])
    .execute();
}

// Until now the one account owned everything: its projects and its uploads stay its own.
async function giveEverythingToTheOwner(db: SchemaDb): Promise<void> {
  const owner = sql`(select id from users order by created_at, id limit 1)`;
  await sql`update users set role = 'owner' where id = ${owner}`.execute(db);
  await sql`update projects set owner_id = ${owner}`.execute(db);
  await sql`update attachments set user_id = ${owner}`.execute(db);
}

export async function up(db: SchemaDb): Promise<void> {
  await addColumns(db);
  await createInvites(db);
  await giveEverythingToTheOwner(db);
}

// Without roles and owners every invited account would see and change the owner's projects, and
// running this again would give the owner theirs; their data has to go first.
async function refuseInvitedAccounts(db: SchemaDb): Promise<void> {
  const invited = await sql<{
    id: string;
  }>`select id from users where role = 'user' limit 1`.execute(db);
  if (invited.rows.length > 0) {
    throw new Error(
      "Can't undo 0011_user_projects while invited accounts exist: their projects would become " +
        "the owner's. Restore the backup taken before the release instead.",
    );
  }
}

export async function down(db: SchemaDb): Promise<void> {
  await refuseInvitedAccounts(db);
  await db.schema.dropTable('invites').execute();
  await db.schema.alterTable('attachments').dropColumn('user_id').execute();
  await db.schema.dropIndex('projects_owner_idx').execute();
  await db.schema.alterTable('projects').dropColumn('owner_id').execute();
  await db.schema.alterTable('users').dropColumn('role').execute();
  await db.schema.alterTable('users').dropColumn('name').execute();
}
