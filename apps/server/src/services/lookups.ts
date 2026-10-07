import { formatTicketKey, parseTicketKey } from '@tracker/shared';
import type { Db, ProjectRow, StatusRow, TicketRow } from '../db/schema';
import { notFound } from '../errors';
import { findProjectById, findProjectByKey } from '../repositories/projects';
import { listStatusRows } from '../repositories/statuses';
import { findTicketById, findTicketByNum } from '../repositories/tickets';

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

export async function requireProject(db: Db, key: string): Promise<ProjectRow> {
  const project = await findProjectByKey(db, key.trim().toUpperCase());
  if (!project) throw notFound(`Project ${key} was not found.`);
  return project;
}

export async function findTicketRef(db: Db, key: string): Promise<TicketRef | null> {
  const parsed = parseTicketKey(key);
  if (!parsed) return null;
  const project = await findProjectByKey(db, parsed.projectKey);
  const ticket = project ? await findTicketByNum(db, project.id, parsed.num) : undefined;
  return project && ticket ? { ticket, project } : null;
}

export async function requireTicket(db: Db, key: string): Promise<TicketRef> {
  const ref = await findTicketRef(db, key);
  if (!ref) throw notFound(`Ticket ${key} was not found.`);
  return ref;
}

export async function requireTicketById(db: Db, id: string): Promise<TicketRef> {
  const ticket = await findTicketById(db, id);
  const project = ticket ? await findProjectById(db, ticket.projectId) : undefined;
  if (!ticket || !project) throw notFound('Ticket was not found.');
  return { ticket, project };
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

export async function requireTicketScope(db: Db, key: string): Promise<TicketScope> {
  return loadTicketScope(db, await requireTicket(db, key));
}
