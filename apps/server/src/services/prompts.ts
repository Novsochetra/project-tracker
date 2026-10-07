import {
  buildProjectPrompt,
  buildTicketPrompt,
  formatTicketKey,
  workableTickets,
  type PromptProject,
  type PromptResult,
  type PromptReview,
  type PromptTicket,
} from '@tracker/shared';
import type { ActivityRow, ProjectRow, TicketRow } from '../db/schema';
import { listActivitiesOfTickets, listTicketActivities } from '../repositories/activities';
import { listStatusRows } from '../repositories/statuses';
import { listTicketRows } from '../repositories/tickets';
import type { ServiceContext } from './context';
import { requireProject, requireTicketScope } from './lookups';

const promptProject = (project: ProjectRow): PromptProject => ({
  name: project.name,
  key: project.key,
  repo: project.repo,
});

function lastReview(activities: readonly ActivityRow[]): PromptReview | null {
  const review = activities.filter((row) => row.type === 'review').at(-1);
  if (!review?.reviewVerdict) return null;
  return { verdict: review.reviewVerdict, rating: review.reviewRating ?? 0, text: review.text };
}

export function promptTicket(
  ticket: TicketRow,
  projectKey: string,
  statusName: string,
  activities: readonly ActivityRow[],
): PromptTicket {
  return {
    key: formatTicketKey(projectKey, ticket.num),
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    statusName,
    due: ticket.due,
    assignee: ticket.assignee,
    notes: activities
      .filter((row) => row.type === 'comment' && row.text.trim())
      .map((row) => row.text),
    lastReport: activities.filter((row) => row.type === 'report').at(-1)?.text ?? null,
    lastReview: lastReview(activities),
  };
}

export async function ticketPrompt(ctx: ServiceContext, key: string): Promise<PromptResult> {
  const scope = await requireTicketScope(ctx.db, key);
  const activities = await listTicketActivities(ctx.db, scope.ticket.id);
  const ticket = promptTicket(scope.ticket, scope.project.key, scope.status.name, activities);
  return { text: buildTicketPrompt(promptProject(scope.project), ticket), ticketCount: 1 };
}

export async function projectPrompt(ctx: ServiceContext, key: string): Promise<PromptResult> {
  const project = await requireProject(ctx.db, key);
  const statuses = await listStatusRows(ctx.db, project.id);
  const tickets = workableTickets(await listTicketRows(ctx.db, project.id), statuses);
  if (tickets.length === 0) return { text: '', ticketCount: 0 };
  const activities = await listActivitiesOfTickets(
    ctx.db,
    tickets.map((ticket) => ticket.id),
  );
  const names = new Map(statuses.map((status) => [status.id, status.name]));
  const prompts = tickets.map((ticket) =>
    promptTicket(
      ticket,
      project.key,
      names.get(ticket.statusId) ?? '',
      activities.filter((row) => row.ticketId === ticket.id),
    ),
  );
  return {
    text: buildProjectPrompt(promptProject(project), prompts),
    ticketCount: tickets.length,
  };
}
