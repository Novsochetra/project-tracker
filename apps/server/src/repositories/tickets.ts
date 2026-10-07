import type { Rankable } from '@tracker/shared';
import type { Db, TicketRow } from '../db/schema';

export type TicketChanges = Partial<Omit<TicketRow, 'id' | 'projectId' | 'num' | 'createdAt'>>;

export interface TicketItemRow extends TicketRow {
  commentCount: number;
  attachmentCount: number;
}

export const findTicketByNum = (db: Db, projectId: string, num: number) =>
  db
    .selectFrom('tickets')
    .selectAll()
    .where('projectId', '=', projectId)
    .where('num', '=', num)
    .executeTakeFirst();

export const findTicketById = (db: Db, id: string) =>
  db.selectFrom('tickets').selectAll().where('id', '=', id).executeTakeFirst();

export const listTicketRows = (db: Db, projectId: string) =>
  db.selectFrom('tickets').selectAll().where('projectId', '=', projectId).execute();

export async function listTicketItemRows(db: Db, projectId: string): Promise<TicketItemRow[]> {
  const rows = await db
    .selectFrom('tickets')
    .selectAll('tickets')
    .select((eb) => [
      eb
        .selectFrom('activities')
        .select((sub) => sub.fn.countAll().as('count'))
        .whereRef('activities.ticketId', '=', 'tickets.id')
        .where('activities.type', '=', 'comment')
        .as('commentCount'),
      eb
        .selectFrom('attachments')
        .select((sub) => sub.fn.countAll().as('count'))
        .whereRef('attachments.ticketId', '=', 'tickets.id')
        .as('attachmentCount'),
    ])
    .where('tickets.projectId', '=', projectId)
    .execute();
  return rows.map((row) => ({
    ...row,
    commentCount: Number(row.commentCount ?? 0),
    attachmentCount: Number(row.attachmentCount ?? 0),
  }));
}

export const listGroupRanks = (db: Db, statusId: string): Promise<Rankable[]> =>
  db.selectFrom('tickets').select(['id', 'rank', 'num']).where('statusId', '=', statusId).execute();

export const listTicketsInStatus = (db: Db, statusId: string) =>
  db.selectFrom('tickets').selectAll().where('statusId', '=', statusId).execute();

export async function insertTicket(db: Db, row: TicketRow): Promise<void> {
  await db.insertInto('tickets').values(row).execute();
}

export async function updateTicketRow(db: Db, id: string, changes: TicketChanges): Promise<void> {
  await db.updateTable('tickets').set(changes).where('id', '=', id).execute();
}

// Conditional on the old status so two agents can't claim the same ticket at once.
export async function updateTicketInStatus(
  db: Db,
  id: string,
  statusId: string,
  changes: TicketChanges,
): Promise<boolean> {
  const result = await db
    .updateTable('tickets')
    .set(changes)
    .where('id', '=', id)
    .where('statusId', '=', statusId)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export async function deleteTicketRow(db: Db, id: string): Promise<void> {
  await db.deleteFrom('tickets').where('id', '=', id).execute();
}

export async function deleteProjectTickets(db: Db, projectId: string): Promise<void> {
  await db.deleteFrom('tickets').where('projectId', '=', projectId).execute();
}

export async function listAssignees(db: Db): Promise<string[]> {
  const rows = await db
    .selectFrom('tickets')
    .select('assignee')
    .distinct()
    .where('assignee', '<>', '')
    .execute();
  return rows.map((row) => row.assignee);
}
