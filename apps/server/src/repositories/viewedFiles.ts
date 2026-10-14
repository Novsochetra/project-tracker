import type { ViewedFileRow } from '../db/changeTables';
import type { Db } from '../db/schema';

export const listViewedFiles = (db: Db, ticketId: string) =>
  db.selectFrom('ticketViewedFiles').selectAll().where('ticketId', '=', ticketId).execute();

export async function markFileViewed(db: Db, row: ViewedFileRow): Promise<void> {
  await db
    .insertInto('ticketViewedFiles')
    .values(row)
    .onConflict((oc) =>
      oc
        .columns(['ticketId', 'path'])
        .doUpdateSet({ digest: row.digest, createdAt: row.createdAt }),
    )
    .execute();
}

export async function unmarkFileViewed(db: Db, ticketId: string, path: string): Promise<void> {
  await db
    .deleteFrom('ticketViewedFiles')
    .where('ticketId', '=', ticketId)
    .where('path', '=', path)
    .execute();
}
