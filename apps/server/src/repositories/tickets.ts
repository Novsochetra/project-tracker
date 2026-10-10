import type { Rankable, ReviewVerdict } from '@tracker/shared';
import type { ExpressionBuilder, InferResult } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { Database, Db, TicketRow } from '../db/schema';

export type TicketChanges = Partial<
  Omit<TicketRow, 'id' | 'projectId' | 'num' | 'createdAt' | 'clientId'>
>;

export interface TicketItemRow extends TicketRow {
  commentCount: number;
  attachmentCount: number;
  lastReviewVerdict: ReviewVerdict | null;
  lastReviewRating: number | null;
  waiting: boolean;
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

export const findTicketByClientId = (db: Db, projectId: string, clientId: string) =>
  db
    .selectFrom('tickets')
    .selectAll()
    .where('projectId', '=', projectId)
    .where('clientId', '=', clientId)
    .executeTakeFirst();

export const listTicketRows = (db: Db, projectId: string) =>
  db.selectFrom('tickets').selectAll().where('projectId', '=', projectId).execute();

const latestReview = (eb: ExpressionBuilder<Database, 'tickets'>) =>
  eb
    .selectFrom('activities')
    .whereRef('activities.ticketId', '=', 'tickets.id')
    .where('activities.type', '=', 'review')
    .orderBy('activities.createdAt', 'desc')
    .orderBy('activities.id', 'desc')
    .limit(1);

// Requests are ended lazily (settleRequests), so one past its deadline or of an ended run may
// still say open: only a live one counts. Another user's run never asks this one anything.
const waitingFor =
  (userId: UserScope, now: number) => (eb: ExpressionBuilder<Database, 'tickets'>) =>
    eb
      .exists(
        eb
          .selectFrom('runs')
          .innerJoin('runRequests', 'runRequests.runId', 'runs.id')
          .select('runRequests.id')
          .whereRef('runs.ticketId', '=', 'tickets.id')
          .where('runs.status', '=', 'running')
          .where((sub) =>
            userId === null ? sub('runs.userId', 'is', null) : sub('runs.userId', '=', userId),
          )
          .where('runRequests.status', '=', 'open')
          .where('runRequests.expiresAt', '>', now),
      )
      .as('waiting');

export interface ItemReader {
  userId: UserScope;
  now: number;
}

// Counts, the latest review and whether Claude waits come from correlated subqueries, so a list
// is one query.
const selectTicketItems = (db: Db, { userId, now }: ItemReader) =>
  db
    .selectFrom('tickets')
    .selectAll('tickets')
    .select(waitingFor(userId, now))
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
      latestReview(eb).select('activities.reviewVerdict').as('lastReviewVerdict'),
      latestReview(eb).select('activities.reviewRating').as('lastReviewRating'),
    ]);

type SelectedItemRow = InferResult<ReturnType<typeof selectTicketItems>>[number];

const toItemRow = (row: SelectedItemRow): TicketItemRow => ({
  ...row,
  commentCount: Number(row.commentCount ?? 0),
  attachmentCount: Number(row.attachmentCount ?? 0),
  lastReviewVerdict: row.lastReviewVerdict ?? null,
  lastReviewRating: row.lastReviewRating === null ? null : Number(row.lastReviewRating),
  // SQLite answers exists() with 0 or 1, Postgres with a boolean.
  waiting: Boolean(row.waiting),
});

export async function listTicketItemRows(
  db: Db,
  reader: ItemReader,
  projectId: string,
): Promise<TicketItemRow[]> {
  const rows = await selectTicketItems(db, reader)
    .where('tickets.projectId', '=', projectId)
    .execute();
  return rows.map(toItemRow);
}

export async function listTicketItemRowsInStatuses(
  db: Db,
  reader: ItemReader,
  statusIds: readonly string[],
): Promise<TicketItemRow[]> {
  if (statusIds.length === 0) return [];
  const rows = await selectTicketItems(db, reader)
    .where('tickets.statusId', 'in', statusIds)
    .orderBy('tickets.updatedAt', 'desc')
    .orderBy('tickets.id')
    .execute();
  return rows.map(toItemRow);
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

export type TicketMatch = Partial<
  Pick<TicketRow, 'statusId' | 'title' | 'description' | 'assignee'>
>;

// Writes only while the row still has the matched values, which another connection may have
// changed since it was read. Says whether it wrote.
export async function updateTicketMatching(
  db: Db,
  id: string,
  match: TicketMatch,
  changes: TicketChanges,
): Promise<boolean> {
  let update = db.updateTable('tickets').set(changes).where('id', '=', id);
  for (const [column, value] of Object.entries(match)) {
    update = update.where(column as keyof TicketMatch, '=', value);
  }
  const result = await update.executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

// Conditional on the old status so two agents can't claim the same ticket at once.
export const updateTicketInStatus = (
  db: Db,
  id: string,
  statusId: string,
  changes: TicketChanges,
): Promise<boolean> => updateTicketMatching(db, id, { statusId }, changes);

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
