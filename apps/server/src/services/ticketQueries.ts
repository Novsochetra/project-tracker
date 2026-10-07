import {
  byRank,
  findStatusByName,
  matchesSearch,
  type ListTicketsQuery,
  type ProjectBoard,
  type Status,
  type TicketDetail,
  type TicketListItem,
} from '@tracker/shared';
import type { AttachmentRow, Db, StatusRow, TicketRow } from '../db/schema';
import { listTicketActivities } from '../repositories/activities';
import { listTicketAttachments } from '../repositories/attachments';
import { listStatusRows } from '../repositories/statuses';
import { listTicketItemRows } from '../repositories/tickets';
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

export async function getBoard(ctx: ServiceContext, projectKey: string): Promise<ProjectBoard> {
  const project = await requireProject(ctx.db, projectKey);
  const statuses = await listStatusRows(ctx.db, project.id);
  const tickets = await listTicketItemRows(ctx.db, project.id);
  return {
    project: toProject(project),
    statuses: statuses.map(toStatus),
    tickets: sortForBoard(tickets, statuses).map((row) => toTicketListItem(row, project.key)),
  };
}

function allowedStatusIds(statuses: Status[], query: ListTicketsQuery): Set<string> {
  let allowed = statuses;
  if (query.status) {
    const named = findStatusByName(statuses, query.status);
    allowed = named ? [named] : [];
  }
  if (query.category) allowed = allowed.filter((status) => status.category === query.category);
  return new Set(allowed.map((status) => status.id));
}

export async function listTickets(
  ctx: ServiceContext,
  projectKey: string,
  query: ListTicketsQuery,
): Promise<TicketListItem[]> {
  const board = await getBoard(ctx, projectKey);
  const allowed = allowedStatusIds(board.statuses, query);
  return board.tickets.filter(
    (ticket) => allowed.has(ticket.statusId) && matchesSearch(ticket, query.q ?? ''),
  );
}
