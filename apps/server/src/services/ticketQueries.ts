import {
  byRank,
  matchesSearch,
  sortStatuses,
  type ListTicketsQuery,
  type ProjectBoard,
  type Status,
  type TicketDetail,
  type TicketListItem,
  type TicketsAcrossProjects,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { AttachmentRow, Db, StatusRow, TicketRow } from '../db/schema';
import { listTicketActivities } from '../repositories/activities';
import { listTicketAttachments } from '../repositories/attachments';
import { listProjectRows } from '../repositories/projects';
import { listAllStatusRows, listStatusRows } from '../repositories/statuses';
import { listTicketItemRows, listTicketItemRowsInStatuses } from '../repositories/tickets';
import type { ServiceContext } from './context';
import {
  loadTicketScope,
  requireProject,
  requireTicket,
  requireTicketById,
  type TicketRef,
} from './lookups';
import {
  toActivity,
  toAttachment,
  toProject,
  toStatus,
  toTicket,
  toTicketListItem,
} from './mappers';

function groupByActivity(attachments: readonly AttachmentRow[]): Map<string, AttachmentRow[]> {
  const groups = new Map<string, AttachmentRow[]>();
  for (const attachment of attachments) {
    if (!attachment.activityId) continue;
    groups.set(attachment.activityId, [...(groups.get(attachment.activityId) ?? []), attachment]);
  }
  return groups;
}

export async function loadTicketDetail(db: Db, ref: TicketRef): Promise<TicketDetail> {
  const scope = await loadTicketScope(db, ref);
  const activities = await listTicketActivities(db, ref.ticket.id);
  const attachments = await listTicketAttachments(db, ref.ticket.id);
  const byActivity = groupByActivity(attachments);
  return {
    ticket: toTicket(scope.ticket, scope.project.key),
    project: toProject(scope.project),
    status: toStatus(scope.status),
    statuses: scope.statuses.map(toStatus),
    activity: activities.map((row) => toActivity(row, byActivity.get(row.id) ?? [])),
    attachments: attachments.filter((row) => row.activityId === null).map(toAttachment),
  };
}

export const getTicketDetail = async (ctx: ServiceContext, key: string) =>
  loadTicketDetail(ctx.db, await requireTicket(ctx.db, key));

export const getTicketDetailById = async (db: Db, id: string) =>
  loadTicketDetail(db, await requireTicketById(db, id));

export function sortForBoard<T extends TicketRow>(
  tickets: readonly T[],
  statuses: StatusRow[],
): T[] {
  const order = new Map(statuses.map((status, index) => [status.id, index]));
  const position = (ticket: T) => order.get(ticket.statusId) ?? statuses.length;
  return [...tickets].sort((a, b) => position(a) - position(b) || byRank(a, b));
}

const readerOf = (ctx: ServiceContext, userId: UserScope) => ({ userId, now: ctx.now() });

export async function getBoard(
  ctx: ServiceContext,
  userId: UserScope,
  projectKey: string,
): Promise<ProjectBoard> {
  const project = await requireProject(ctx.db, projectKey);
  const statuses = await listStatusRows(ctx.db, project.id);
  const tickets = await listTicketItemRows(ctx.db, readerOf(ctx, userId), project.id);
  return {
    project: toProject(project),
    statuses: statuses.map(toStatus),
    tickets: sortForBoard(tickets, statuses).map((row) => toTicketListItem(row, project.key)),
  };
}

type StatusFields = Pick<Status, 'id' | 'name' | 'category'>;

// Names are unique within a project, so across projects a name can match one status in each.
function allowedStatusIds(statuses: readonly StatusFields[], query: ListTicketsQuery): string[] {
  const name = query.status ? query.status.trim().toLowerCase() : null;
  return statuses
    .filter((status) => name === null || status.name.toLowerCase() === name)
    .filter((status) => !query.category || status.category === query.category)
    .map((status) => status.id);
}

export async function listTickets(
  ctx: ServiceContext,
  userId: UserScope,
  projectKey: string,
  query: ListTicketsQuery,
): Promise<TicketListItem[]> {
  const board = await getBoard(ctx, userId, projectKey);
  const allowed = new Set(allowedStatusIds(board.statuses, query));
  return board.tickets.filter(
    (ticket) => allowed.has(ticket.statusId) && matchesSearch(ticket, query.q ?? ''),
  );
}

export async function listAllTickets(
  ctx: ServiceContext,
  userId: UserScope,
  query: ListTicketsQuery,
): Promise<TicketsAcrossProjects> {
  const projectKeys = new Map((await listProjectRows(ctx.db)).map((row) => [row.id, row.key]));
  const statuses = await listAllStatusRows(ctx.db);
  const statusIds = allowedStatusIds(statuses, query);
  const rows = await listTicketItemRowsInStatuses(ctx.db, readerOf(ctx, userId), statusIds);
  const tickets = rows
    .map((row) => toTicketListItem(row, projectKeys.get(row.projectId) ?? ''))
    .filter((ticket) => matchesSearch(ticket, query.q ?? ''));
  const listed = new Set(tickets.map((ticket) => ticket.projectId));
  return {
    tickets,
    statuses: sortStatuses(statuses.filter((status) => listed.has(status.projectId))).map(toStatus),
  };
}
