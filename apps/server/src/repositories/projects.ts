import type { Db, ProjectRow } from '../db/schema';

export const findProjectByKey = (db: Db, key: string) =>
  db.selectFrom('projects').selectAll().where('key', '=', key).executeTakeFirst();

export const findProjectById = (db: Db, id: string) =>
  db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst();

export const listProjectRows = (db: Db) =>
  db.selectFrom('projects').selectAll().orderBy('createdAt').orderBy('id').execute();

export async function insertProject(db: Db, row: ProjectRow): Promise<void> {
  await db.insertInto('projects').values(row).execute();
}

export async function updateProjectRow(
  db: Db,
  id: string,
  changes: Partial<Omit<ProjectRow, 'id'>>,
): Promise<void> {
  await db.updateTable('projects').set(changes).where('id', '=', id).execute();
}

export async function deleteProjectRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('projects').where('id', '=', id).execute();
}

export async function takeTicketNumber(db: Db, projectId: string): Promise<number> {
  const row = await db
    .updateTable('projects')
    .set((eb) => ({ nextNum: eb('nextNum', '+', 1) }))
    .where('id', '=', projectId)
    .returning('nextNum')
    .executeTakeFirstOrThrow();
  return Number(row.nextNum) - 1;
}

export interface ProjectTicketStats {
  projectId: string;
  total: number;
  done: number;
  lastUpdatedAt: number;
}

export async function ticketStatsByProject(db: Db): Promise<ProjectTicketStats[]> {
  const rows = await db
    .selectFrom('tickets')
    .innerJoin('statuses', 'statuses.id', 'tickets.statusId')
    .select((eb) => [
      'tickets.projectId',
      eb.fn.countAll().as('total'),
      eb.fn
        .sum(eb.case().when('statuses.category', '=', 'done').then(eb.lit(1)).else(eb.lit(0)).end())
        .as('done'),
      eb.fn.max('tickets.updatedAt').as('lastUpdatedAt'),
    ])
    .groupBy('tickets.projectId')
    .execute();
  return rows.map((row) => ({
    projectId: row.projectId,
    total: Number(row.total),
    done: Number(row.done),
    lastUpdatedAt: Number(row.lastUpdatedAt),
  }));
}
