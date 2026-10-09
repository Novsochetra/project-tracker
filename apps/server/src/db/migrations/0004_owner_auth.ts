import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// Only one owner signs in today; a table keeps the account out of env vars and lets sessions and
// tokens point at it.
async function createUsers(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('updated_at', 'bigint', (col) => col.notNull())
    .addUniqueConstraint('users_email_unique', ['email'])
    .execute();
}

// The id is the SHA-256 of the cookie's secret, so a copy of the table can't sign anyone in.
async function createSessions(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('sessions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('last_seen_at', 'bigint', (col) => col.notNull())
    .addColumn('expires_at', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema.createIndex('sessions_user_idx').on('sessions').column('user_id').execute();
}

async function createApiTokens(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('api_tokens')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('hint', 'text', (col) => col.notNull())
    .addColumn('token_hash', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('last_used_at', 'bigint')
    .addUniqueConstraint('api_tokens_token_hash_unique', ['token_hash'])
    .execute();
  await db.schema.createIndex('api_tokens_user_idx').on('api_tokens').column('user_id').execute();
}

export async function up(db: SchemaDb): Promise<void> {
  await createUsers(db);
  await createSessions(db);
  await createApiTokens(db);
}

export async function down(db: SchemaDb): Promise<void> {
  for (const table of ['api_tokens', 'sessions', 'users']) {
    await db.schema.dropTable(table).execute();
  }
}
