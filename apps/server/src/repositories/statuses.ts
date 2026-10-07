import { sortStatuses } from '@tracker/shared';
import type { Db, StatusRow } from '../db/schema';

export async function listStatusRows(db: Db, projectId: string): Promise<StatusRow[]> {
  const rows = await db
    .selectFrom('statuses')
    .selectAll()
    .where('projectId', '=', projectId)
    .execute();
  return sortStatuses(rows);
}

export const findStatusById = (db: Db, id: string) =>
  db.selectFrom('statuses').selectAll().where('id', '=', id).executeTakeFirst();

export async function insertStatuses(db: Db, rows: StatusRow[]): Promise<void> {
  if (rows.length > 0) await db.insertInto('statuses').values(rows).execute();
}

export async function updateStatusRow(
  db: Db,
  id: string,
  changes: Partial<Omit<StatusRow, 'id' | 'projectId'>>,
): Promise<void> {
  await db.updateTable('statuses').set(changes).where('id', '=', id).execute();
}

export async function deleteStatusRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('statuses').where('id', '=', id).execute();
}
