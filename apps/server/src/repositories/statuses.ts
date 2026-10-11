import { sortStatuses } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { Db, StatusRow } from '../db/schema';
import { ownedBy } from './projects';

export async function listStatusRows(db: Db, projectId: string): Promise<StatusRow[]> {
  const rows = await db
    .selectFrom('statuses')
    .selectAll()
    .where('projectId', '=', projectId)
    .execute();
  return sortStatuses(rows);
}

export const listAllStatusRows = (db: Db, scope: UserScope): Promise<StatusRow[]> =>
  db
    .selectFrom('statuses')
    .innerJoin('projects', 'projects.id', 'statuses.projectId')
    .selectAll('statuses')
    .where(ownedBy(scope))
    .execute();

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
