import { parseTicketKey, type PromptTicket } from '@tracker/shared';
import type { ChatRow } from '../db/chatTables';
import type { Db, ProjectRow, TicketRow } from '../db/schema';
import { notFound } from '../errors';
import { listTicketActivities } from '../repositories/activities';
import { findStatusById } from '../repositories/statuses';
import { findTicketById, findTicketByNum } from '../repositories/tickets';
import { promptTicket, ticketLabels } from './prompts';

// Only a ticket of the chat's own project, so the chat's key and prompt name the right one.
export async function requireChatTicket(
  db: Db,
  project: ProjectRow,
  key: string,
): Promise<TicketRow> {
  const parsed = parseTicketKey(key);
  const ticket =
    parsed?.projectKey === project.key
      ? await findTicketByNum(db, project.id, parsed.num)
      : undefined;
  if (!ticket) throw notFound(`Ticket ${key} was not found.`);
  return ticket;
}

export async function chatPromptTicket(
  db: Db,
  chat: Pick<ChatRow, 'ticketId'>,
  projectKey: string,
): Promise<PromptTicket | null> {
  const ticket = chat.ticketId ? await findTicketById(db, chat.ticketId) : undefined;
  if (!ticket) return null;
  const status = await findStatusById(db, ticket.statusId);
  return promptTicket(ticket, projectKey, {
    statusName: status?.name ?? '',
    activities: await listTicketActivities(db, ticket.id),
    labels: await ticketLabels(db, ticket),
  });
}
