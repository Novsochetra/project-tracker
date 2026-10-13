import type { PushKeyRow } from '../db/pushTables';
import type { Db } from '../db/schema';

const VAPID_ID = 'vapid';

export const findStoredKeys = (db: Db) =>
  db.selectFrom('pushKeys').selectAll().where('id', '=', VAPID_ID).executeTakeFirst();

// Two servers starting at once keep whichever pair landed first.
export async function storeKeysOnce(
  db: Db,
  keys: Pick<PushKeyRow, 'publicKey' | 'privateKey' | 'createdAt'>,
): Promise<void> {
  await db
    .insertInto('pushKeys')
    .values({ id: VAPID_ID, ...keys })
    .onConflict((conflict) => conflict.column('id').doNothing())
    .execute();
}
