import type { ReviewVerdict } from '@tracker/shared';
import type { RunChangesRow } from '../db/changeTables';
import type { Db } from '../db/schema';

// A helper that retries sends the same run's changes again; the last one counts.
export async function saveRunChanges(db: Db, row: RunChangesRow): Promise<void> {
  await db
    .insertInto('runChanges')
    .values(row)
    .onConflict((oc) =>
      oc.column('runId').doUpdateSet({ diff: row.diff, cut: row.cut, createdAt: row.createdAt }),
    )
    .execute();
}

export const latestTicketChanges = (db: Db, ticketId: string) =>
  db
    .selectFrom('runChanges')
    .selectAll()
    .where('ticketId', '=', ticketId)
    .orderBy('createdAt', 'desc')
    .orderBy('runId', 'desc')
    .limit(1)
    .executeTakeFirst();

export const findRunChanges = (db: Db, runId: string) =>
  db.selectFrom('runChanges').selectAll().where('runId', '=', runId).executeTakeFirst();

export async function setChangesVerdict(
  db: Db,
  runId: string,
  verdict: ReviewVerdict,
): Promise<void> {
  await db.updateTable('runChanges').set({ verdict }).where('runId', '=', runId).execute();
}
