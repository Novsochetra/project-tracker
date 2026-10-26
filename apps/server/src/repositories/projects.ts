import type { ExpressionBuilder } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { Database, Db, ProjectRow } from '../db/schema';

// For any query that has projects in it, so lists across projects keep to the user's own.
export const ownedBy = (scope: UserScope) => (eb: ExpressionBuilder<Database, 'projects'>) =>
  scope === null ? eb('projects.ownerId', 'is', null) : eb('projects.ownerId', '=', scope);

export const findProjectByKey = (db: Db, key: string) =>
  db.selectFrom('projects').selectAll().where('key', '=', key).executeTakeFirst();

export const findProjectById = (db: Db, id: string) =>
  db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst();

export const listProjectRows = (db: Db, scope: UserScope) =>
  db
    .selectFrom('projects')
    .selectAll()
    .where(ownedBy(scope))
    .orderBy('createdAt')
    .orderBy('id')
    .execute();

// Keys are unique across the tracker, whoever owns the project.
export async function listProjectKeys(db: Db): Promise<string[]> {
  return (await db.selectFrom('projects').select('key').execute()).map((row) => row.key);
}

export const assignOwnerlessProjects = (db: Db, userId: string) =>
  db.updateTable('projects').set({ ownerId: userId }).where('ownerId', 'is', null).execute();

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
  reviewed: number;
  lastUpdatedAt: number;
}

export async function ticketStatsByProject(
  db: Db,
  scope: UserScope,
): Promise<ProjectTicketStats[]> {
  const rows = await db
    .selectFrom('tickets')
    .innerJoin('statuses', 'statuses.id', 'tickets.statusId')
    .innerJoin('projects', 'projects.id', 'tickets.projectId')
    .where(ownedBy(scope))
    .select((eb) => [
      'tickets.projectId',
      eb.fn.countAll().as('total'),
      eb.fn
        .sum(eb.case().when('statuses.category', '=', 'done').then(eb.lit(1)).else(eb.lit(0)).end())
        .as('done'),
      eb.fn
        .sum(
          eb
            .case()
            .when('statuses.category', '=', 'reviewed')
            .then(eb.lit(1))
            .else(eb.lit(0))
            .end(),
        )
        .as('reviewed'),
      eb.fn.max('tickets.updatedAt').as('lastUpdatedAt'),
    ])
    .groupBy('tickets.projectId')
    .execute();
  return rows.map((row) => ({
    projectId: row.projectId,
    total: Number(row.total),
    done: Number(row.done),
    reviewed: Number(row.reviewed),
    lastUpdatedAt: Number(row.lastUpdatedAt),
  }));
}

// An update that changes nothing still holds the row until the transaction ends, in both
// databases' SQL, where "select ... for update" is Postgres only. So takes of one project's runs
// start one at a time, and each one's count sees the runs the others started.
export async function holdProjectRuns(db: Db, projectId: string): Promise<void> {
  await db
    .updateTable('projects')
    .set((eb) => ({ updatedAt: eb.ref('updatedAt') }))
    .where('id', '=', projectId)
    .execute();
}
