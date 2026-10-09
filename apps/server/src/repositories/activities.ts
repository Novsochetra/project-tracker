import type { ActivityRow, Db } from '../db/schema';

export async function insertActivity(db: Db, row: ActivityRow): Promise<void> {
  await db.insertInto('activities').values(row).execute();
}

export const findActivityById = (db: Db, id: string) =>
  db.selectFrom('activities').selectAll().where('id', '=', id).executeTakeFirst();

export const listTicketActivities = (db: Db, ticketId: string) =>
  db
    .selectFrom('activities')
    .selectAll()
    .where('ticketId', '=', ticketId)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

export async function listActivitiesOfTickets(db: Db, ticketIds: string[]): Promise<ActivityRow[]> {
  if (ticketIds.length === 0) return [];
  return db
    .selectFrom('activities')
    .selectAll()
    .where('ticketId', 'in', ticketIds)
    .orderBy('createdAt')
    .orderBy('id')
    .execute();
}

export async function updateActivityRow(
  db: Db,
  id: string,
  changes: Pick<ActivityRow, 'text' | 'editedAt'>,
): Promise<void> {
  await db.updateTable('activities').set(changes).where('id', '=', id).execute();
}

// Conditional on the text the edit was typed over, so an edit can't overwrite one committed after
// it read the row (Postgres with several connections).
export async function updateActivityMatching(
  db: Db,
  id: string,
  text: string,
  changes: Pick<ActivityRow, 'text' | 'editedAt'>,
): Promise<boolean> {
  const result = await db
    .updateTable('activities')
    .set(changes)
    .where('id', '=', id)
    .where('text', '=', text)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export async function deleteActivityRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('activities').where('id', '=', id).execute();
}
