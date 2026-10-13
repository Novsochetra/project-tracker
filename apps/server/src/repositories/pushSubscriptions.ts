import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { PushSubscriptionRow } from '../db/pushTables';
import type { Database, Db } from '../db/schema';

const ownedBy = (userId: UserScope) => (eb: ExpressionBuilder<Database, 'pushSubscriptions'>) =>
  userId === null ? eb('userId', 'is', null) : eb('userId', '=', userId);

// A device has one address; saving it again, as another user too, makes it that sign-in's.
export async function saveSubscriptionRow(db: Db, row: PushSubscriptionRow): Promise<void> {
  const { userId, sessionId, p256dh, auth } = row;
  await db
    .insertInto('pushSubscriptions')
    .values(row)
    .onConflict((conflict) =>
      conflict.column('endpoint').doUpdateSet({ userId, sessionId, p256dh, auth }),
    )
    .execute();
}

export async function deleteUserSubscription(
  db: Db,
  userId: UserScope,
  endpoint: string,
): Promise<void> {
  await db
    .deleteFrom('pushSubscriptions')
    .where(ownedBy(userId))
    .where('endpoint', '=', endpoint)
    .execute();
}

// The push service said the address is gone, whoever's it was.
export async function deleteSubscriptionAt(db: Db, endpoint: string): Promise<void> {
  await db.deleteFrom('pushSubscriptions').where('endpoint', '=', endpoint).execute();
}

export const listUserSubscriptions = (db: Db, userId: UserScope) =>
  db
    .selectFrom('pushSubscriptions')
    .select(['endpoint', 'p256dh', 'auth'])
    .where(ownedBy(userId))
    .execute();

export const deleteOwnerlessSubscriptions = (db: Db) =>
  db.deleteFrom('pushSubscriptions').where('userId', 'is', null).execute();
