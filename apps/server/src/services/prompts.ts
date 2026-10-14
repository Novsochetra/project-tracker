import {
  buildProjectPrompt,
  buildReviewPrompt,
  buildTicketPrompt,
  formatTicketKey,
  lineNote,
  roleForCategory,
  workableTickets,
  type PromptLabel,
  type PromptProject,
  type PromptResult,
  type PromptReview,
  type PromptTicket,
} from '@tracker/shared';
import type { LabelRow } from '../db/labelTables';
import type { ActivityRow, Db, ProjectRow, TicketRow } from '../db/schema';
import { listActivitiesOfTickets, listTicketActivities } from '../repositories/activities';
import { listLabelRows } from '../repositories/labels';
import { listStatusRows } from '../repositories/statuses';
import { labelIdsInProject, labelIdsOfTicket } from '../repositories/ticketLabels';
import { listTicketRows } from '../repositories/tickets';
import type { UserContext } from './context';
import { requireProject, requireTicketScope } from './lookups';

const promptProject = (project: ProjectRow): PromptProject => ({
  name: project.name,
  key: project.key,
  repo: project.repo,
  instructions: project.instructions,
  maxSubAgents: project.maxSubAgents,
});

function lastReview(activities: readonly ActivityRow[]): PromptReview | null {
  const review = activities.filter((row) => row.type === 'review').at(-1);
  if (!review?.reviewVerdict) return null;
  return { verdict: review.reviewVerdict, rating: review.reviewRating ?? 0, text: review.text };
}

// A line comment says which line, so the next run fixes that line (the Changes tab).
const noteOf = (row: ActivityRow): string =>
  row.linePath !== null && row.lineSide !== null && row.lineNumber !== null
    ? lineNote({ path: row.linePath, side: row.lineSide, line: row.lineNumber }, row.text)
    : row.text;

const promptLabels = (labels: readonly LabelRow[], ids: readonly string[]): PromptLabel[] =>
  labels
    .filter((label) => ids.includes(label.id))
    .map(({ name, instructions }) => ({ name, instructions }));

export async function ticketLabels(db: Db, ticket: TicketRow): Promise<PromptLabel[]> {
  const ids = await labelIdsOfTicket(db, ticket.id);
  return ids.length > 0 ? promptLabels(await listLabelRows(db, ticket.projectId), ids) : [];
}

export interface TicketContext {
  statusName: string;
  activities: readonly ActivityRow[];
  labels: PromptLabel[];
}

export function promptTicket(
  ticket: TicketRow,
  projectKey: string,
  { statusName, activities, labels }: TicketContext,
): PromptTicket {
  return {
    key: formatTicketKey(projectKey, ticket.num),
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    statusName,
    due: ticket.due,
    assignee: ticket.assignee,
    notes: activities.filter((row) => row.type === 'comment' && row.text.trim()).map(noteOf),
    lastReport: activities.filter((row) => row.type === 'report').at(-1)?.text ?? null,
    lastReview: lastReview(activities),
    labels,
  };
}

export async function ticketPrompt(ctx: UserContext, key: string): Promise<PromptResult> {
  const scope = await requireTicketScope(ctx.db, ctx.scope, key);
  const ticket = promptTicket(scope.ticket, scope.project.key, {
    statusName: scope.status.name,
    activities: await listTicketActivities(ctx.db, scope.ticket.id),
    labels: await ticketLabels(ctx.db, scope.ticket),
  });
  const role = roleForCategory(scope.status.category);
  const build = role === 'review' ? buildReviewPrompt : buildTicketPrompt;
  return { text: build(promptProject(scope.project), ticket), ticketCount: 1, role };
}

export async function projectPrompt(ctx: UserContext, key: string): Promise<PromptResult> {
  const project = await requireProject(ctx.db, ctx.scope, key);
  const statuses = await listStatusRows(ctx.db, project.id);
  const tickets = workableTickets(await listTicketRows(ctx.db, project.id), statuses);
  if (tickets.length === 0) return { text: '', ticketCount: 0, role: 'work' };
  const activities = await listActivitiesOfTickets(
    ctx.db,
    tickets.map((ticket) => ticket.id),
  );
  const names = new Map(statuses.map((status) => [status.id, status.name]));
  const labels = await listLabelRows(ctx.db, project.id);
  const labelIds = await labelIdsInProject(ctx.db, project.id);
  const prompts = tickets.map((ticket) =>
    promptTicket(ticket, project.key, {
      statusName: names.get(ticket.statusId) ?? '',
      activities: activities.filter((row) => row.ticketId === ticket.id),
      labels: promptLabels(labels, labelIds.get(ticket.id) ?? []),
    }),
  );
  return {
    text: buildProjectPrompt(promptProject(project), prompts),
    ticketCount: tickets.length,
    role: 'work',
  };
}
