import type { Kysely } from 'kysely';

type SchemaDb = Kysely<unknown>;

// A subscription goes with the sign-in that made it, so signing out (here or everywhere) stops
// pushes to that device. Null user and session on a tracker without an owner.
async function createSubscriptions(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('push_subscriptions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('session_id', 'text', (col) => col.references('sessions.id').onDelete('cascade'))
    .addColumn('endpoint', 'text', (col) => col.notNull())
    .addColumn('p256dh', 'text', (col) => col.notNull())
    .addColumn('auth', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex('push_subscriptions_endpoint_unique')
    .on('push_subscriptions')
    .column('endpoint')
    .unique()
    .execute();
  await db.schema
    .createIndex('push_subscriptions_user_idx')
    .on('push_subscriptions')
    .column('user_id')
    .execute();
}

async function createKeys(db: SchemaDb): Promise<void> {
  await db.schema
    .createTable('push_keys')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('public_key', 'text', (col) => col.notNull())
    .addColumn('private_key', 'text', (col) => col.notNull())
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .execute();
}

export async function up(db: SchemaDb): Promise<void> {
  await createSubscriptions(db);
  await createKeys(db);
}

export async function down(db: SchemaDb): Promise<void> {
  await db.schema.dropTable('push_keys').execute();
  await db.schema.dropTable('push_subscriptions').execute();
}
