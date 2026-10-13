import {
  byRank,
  hasLabel,
  matchesSearch,
  type Label,
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
import { listLabelRows, listLabelRowsOfProjects } from '../repositories/labels';
import { listAllStatusRows, listStatusRows } from '../repositories/statuses';
import { labelIdsInProject, labelIdsInScope, labelIdsOfTicket } from '../repositories/ticketLabels';
import { listTicketItemRows, listTicketItemRowsInStatuses } from '../repositories/tickets';
import type { UserContext } from './context';
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
  toLabel,
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
  const labelIds = await labelIdsOfTicket(db, ref.ticket.id);
  return {
    ticket: toTicket(scope.ticket, scope.project.key, labelIds),
    project: toProject(scope.project),
    status: toStatus(scope.status),
    statuses: scope.statuses.map(toStatus),
    labels: (await listLabelRows(db, ref.project.id)).map(toLabel),
    activity: activities.map((row) => toActivity(row, byActivity.get(row.id) ?? [])),
    attachments: attachments.filter((row) => row.activityId === null).map(toAttachment),
  };
}

export const getTicketDetail = async (ctx: UserContext, key: string) =>
  loadTicketDetail(ctx.db, await requireTicket(ctx.db, ctx.scope, key));

export const getTicketDetailById = async (db: Db, scope: UserScope, id: string) =>
  loadTicketDetail(db, await requireTicketById(db, scope, id));

export function sortForBoard<T extends TicketRow>(
  tickets: readonly T[],
  statuses: StatusRow[],
): T[] {
  const order = new Map(statuses.map((status, index) => [status.id, index]));
  const position = (ticket: T) => order.get(ticket.statusId) ?? statuses.length;
  return [...tickets].sort((a, b) => position(a) - position(b) || byRank(a, b));
}

const readerOf = (ctx: UserContext) => ({ userId: ctx.scope, now: ctx.now() });

export async function getBoard(ctx: UserContext, projectKey: string): Promise<ProjectBoard> {
  const project = await requireProject(ctx.db, ctx.scope, projectKey);
  const statuses = await listStatusRows(ctx.db, project.id);
  const tickets = await listTicketItemRows(ctx.db, readerOf(ctx), project.id);
  const labelIds = await labelIdsInProject(ctx.db, project.id);
  return {
    project: toProject(project),
    statuses: statuses.map(toStatus),
    labels: (await listLabelRows(ctx.db, project.id)).map(toLabel),
    tickets: sortForBoard(tickets, statuses).map((row) =>
      toTicketListItem(row, project.key, labelIds.get(row.id) ?? []),
    ),
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

// Names are unique within a project, so across projects a name can match one label in each.
function labelFilter(labels: readonly Label[], query: ListTicketsQuery) {
  if (query.label === undefined) return () => true;
  const name = query.label.trim().toLowerCase();
  const ids = labels.filter((label) => label.name.toLowerCase() === name).map((label) => label.id);
  return (ticket: TicketListItem) => ids.some((id) => hasLabel(ticket, id));
}

export async function listTickets(
  ctx: UserContext,
  projectKey: string,
  query: ListTicketsQuery,
): Promise<TicketListItem[]> {
  const board = await getBoard(ctx, projectKey);
  const allowed = new Set(allowedStatusIds(board.statuses, query));
  const labeled = labelFilter(board.labels ?? [], query);
  return board.tickets.filter(
    (ticket) =>
      allowed.has(ticket.statusId) && labeled(ticket) && matchesSearch(ticket, query.q ?? ''),
  );
}

// The statuses are the user's own projects', so their tickets are too.
export async function listAllTickets(
  ctx: UserContext,
  query: ListTicketsQuery,
): Promise<TicketsAcrossProjects> {
  const projects = await listProjectRows(ctx.db, ctx.scope);
  const projectKeys = new Map(projects.map((row) => [row.id, row.key]));
  const statuses = await listAllStatusRows(ctx.db, ctx.scope);
  const statusIds = allowedStatusIds(statuses, query);
  const rows = await listTicketItemRowsInStatuses(ctx.db, readerOf(ctx), statusIds);
  const labelIds = await labelIdsInScope(ctx.db, ctx.scope);
  const labels = (await listLabelRowsOfProjects(ctx.db, ctx.scope)).map(toLabel);
  const labeled = labelFilter(labels, query);
  const tickets = rows
    .map((row) =>
      toTicketListItem(row, projectKeys.get(row.projectId) ?? '', labelIds.get(row.id) ?? []),
    )
    .filter((ticket) => labeled(ticket) && matchesSearch(ticket, query.q ?? ''));
  const listed = new Set(tickets.map((ticket) => ticket.projectId));
  return {
    tickets,
    statuses: sortStatuses(statuses.filter((status) => listed.has(status.projectId))).map(toStatus),
    labels: labels.filter((label) => listed.has(label.projectId)),
  };
}
