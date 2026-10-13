import { formatTicketKey, parseTicketKey } from '@tracker/shared';
import { inScope, type UserScope } from '../auth/scope';
import type { LabelRow } from '../db/labelTables';
import type {
  ActivityRow,
  AttachmentRow,
  Db,
  ProjectRow,
  StatusRow,
  TicketRow,
} from '../db/schema';
import { notFound } from '../errors';
import { findActivityById } from '../repositories/activities';
import { findAttachmentById } from '../repositories/attachments';
import { findLabelById } from '../repositories/labels';
import { findProjectById, findProjectByKey } from '../repositories/projects';
import { findStatusById, listStatusRows } from '../repositories/statuses';
import { findTicketById, findTicketByNum } from '../repositories/tickets';

// Every read and write of project data finds its project here, and a project is only its
// owner's: anyone else gets 404, as if it didn't exist, never 403.

export interface TicketRef {
  ticket: TicketRow;
  project: ProjectRow;
}

export interface TicketScope extends TicketRef {
  statuses: StatusRow[];
  status: StatusRow;
}

export const ticketKeyOf = (ref: TicketRef): string =>
  formatTicketKey(ref.project.key, ref.ticket.num);

const reachable = (project: ProjectRow | undefined, scope: UserScope): ProjectRow | undefined =>
  project && inScope(project.ownerId, scope) ? project : undefined;

export async function requireProject(db: Db, scope: UserScope, key: string): Promise<ProjectRow> {
  const project = reachable(await findProjectByKey(db, key.trim().toUpperCase()), scope);
  if (!project) throw notFound(`Project ${key} was not found.`);
  return project;
}

export async function findTicketRef(
  db: Db,
  scope: UserScope,
  key: string,
): Promise<TicketRef | null> {
  const parsed = parseTicketKey(key);
  if (!parsed) return null;
  const project = reachable(await findProjectByKey(db, parsed.projectKey), scope);
  const ticket = project ? await findTicketByNum(db, project.id, parsed.num) : undefined;
  return project && ticket ? { ticket, project } : null;
}

export async function requireTicket(db: Db, scope: UserScope, key: string): Promise<TicketRef> {
  const ref = await findTicketRef(db, scope, key);
  if (!ref) throw notFound(`Ticket ${key} was not found.`);
  return ref;
}

async function findTicketRefById(db: Db, scope: UserScope, id: string) {
  const ticket = await findTicketById(db, id);
  const project = ticket
    ? reachable(await findProjectById(db, ticket.projectId), scope)
    : undefined;
  return ticket && project ? { ticket, project } : null;
}

export async function requireTicketById(db: Db, scope: UserScope, id: string): Promise<TicketRef> {
  const ref = await findTicketRefById(db, scope, id);
  if (!ref) throw notFound('Ticket was not found.');
  return ref;
}

export async function requireStatus(db: Db, scope: UserScope, id: string): Promise<StatusRow> {
  const status = await findStatusById(db, id);
  const project = status
    ? reachable(await findProjectById(db, status.projectId), scope)
    : undefined;
  if (!status || !project) throw notFound('Status was not found.');
  return status;
}

export async function requireLabel(db: Db, scope: UserScope, id: string): Promise<LabelRow> {
  const label = await findLabelById(db, id);
  const project = label ? reachable(await findProjectById(db, label.projectId), scope) : undefined;
  if (!label || !project) throw notFound('Label was not found.');
  return label;
}

export async function requireActivity(db: Db, scope: UserScope, id: string): Promise<ActivityRow> {
  const activity = await findActivityById(db, id);
  const ref = activity ? await findTicketRefById(db, scope, activity.ticketId) : null;
  if (!activity || !ref) throw notFound('That activity item was not found.');
  return activity;
}

// A file on no ticket yet is only its uploader's.
async function canReachFile(db: Db, scope: UserScope, row: AttachmentRow): Promise<boolean> {
  if (row.ticketId === null) return inScope(row.userId, scope);
  return (await findTicketRefById(db, scope, row.ticketId)) !== null;
}

export async function findReachableAttachment(
  db: Db,
  scope: UserScope,
  id: string,
): Promise<AttachmentRow | undefined> {
  const row = await findAttachmentById(db, id);
  return row && (await canReachFile(db, scope, row)) ? row : undefined;
}

export function requireStatusIn(statuses: readonly StatusRow[], id: string): StatusRow {
  const status = statuses.find((candidate) => candidate.id === id);
  if (!status) throw notFound('Status was not found in this project.');
  return status;
}

export async function loadTicketScope(db: Db, ref: TicketRef): Promise<TicketScope> {
  const statuses = await listStatusRows(db, ref.project.id);
  const status = statuses.find((candidate) => candidate.id === ref.ticket.statusId);
  if (!status) throw new Error(`Ticket ${ref.ticket.id} has no status.`);
  return { ...ref, statuses, status };
}

export async function requireTicketScope(
  db: Db,
  scope: UserScope,
  key: string,
): Promise<TicketScope> {
  return loadTicketScope(db, await requireTicket(db, scope, key));
}
