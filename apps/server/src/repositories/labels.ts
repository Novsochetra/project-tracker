import { sortLabels } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { LabelRow } from '../db/labelTables';
import type { Db } from '../db/schema';
import { ownedBy } from './projects';

export async function listLabelRows(db: Db, projectId: string): Promise<LabelRow[]> {
  const rows = await db
    .selectFrom('labels')
    .selectAll()
    .where('projectId', '=', projectId)
    .execute();
  return sortLabels(rows);
}

export async function listLabelRowsOfProjects(db: Db, scope: UserScope): Promise<LabelRow[]> {
  const rows = await db
    .selectFrom('labels')
    .innerJoin('projects', 'projects.id', 'labels.projectId')
    .selectAll('labels')
    .where(ownedBy(scope))
    .execute();
  return sortLabels(rows);
}

export const findLabelById = (db: Db, id: string) =>
  db.selectFrom('labels').selectAll().where('id', '=', id).executeTakeFirst();

export async function insertLabel(db: Db, row: LabelRow): Promise<void> {
  await db.insertInto('labels').values(row).execute();
}

export async function updateLabelRow(
  db: Db,
  id: string,
  changes: Partial<Omit<LabelRow, 'id' | 'projectId'>>,
): Promise<void> {
  await db.updateTable('labels').set(changes).where('id', '=', id).execute();
}

export async function deleteLabelRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('labels').where('id', '=', id).execute();
}
