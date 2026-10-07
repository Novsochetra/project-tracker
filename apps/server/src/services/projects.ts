import { randomUUID } from 'node:crypto';
import {
  DEFAULT_STATUSES,
  PROJECT_COLORS,
  resolvePrefix,
  uniquePrefix,
  type createProjectInput,
  type Project,
  type ProjectDetail,
  type ProjectSummary,
  type updateProjectInput,
} from '@tracker/shared';
import type { z } from 'zod';
import type { ProjectRow, StatusRow } from '../db/schema';
import {
  deleteProjectRow,
  insertProject,
  listProjectRows,
  ticketStatsByProject,
  updateProjectRow,
  type ProjectTicketStats,
} from '../repositories/projects';
import { storageKeysOfProject } from '../repositories/attachments';
import { insertStatuses, listStatusRows } from '../repositories/statuses';
import { deleteProjectTickets } from '../repositories/tickets';
import { removeFiles } from '../storage/fileStorage';
import { changedFields, isEmpty } from '../util';
import { inTransaction, notify, type ServiceContext } from './context';
import { requireProject } from './lookups';
import { toProject, toStatus } from './mappers';

type CreateProjectValues = z.output<typeof createProjectInput>;
type UpdateProjectValues = z.output<typeof updateProjectInput>;

function summarize(project: ProjectRow, stats: ProjectTicketStats | undefined): ProjectSummary {
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  return {
    ...toProject(project),
    totalCount: total,
    openCount: total - done,
    doneCount: done,
    lastActivityAt: Math.max(project.updatedAt, stats?.lastUpdatedAt ?? 0),
  };
}

export async function listProjectSummaries(ctx: ServiceContext): Promise<ProjectSummary[]> {
  const projects = await listProjectRows(ctx.db);
  const stats = new Map((await ticketStatsByProject(ctx.db)).map((row) => [row.projectId, row]));
  return projects.map((project) => summarize(project, stats.get(project.id)));
}

function defaultStatuses(projectId: string, at: number): StatusRow[] {
  return DEFAULT_STATUSES.map((template, position) => ({
    id: randomUUID(),
    projectId,
    ...template,
    position,
    createdAt: at,
  }));
}

export async function createProject(
  ctx: ServiceContext,
  input: CreateProjectValues,
): Promise<ProjectDetail> {
  const detail = await inTransaction(ctx, async (trx) => {
    const existing = await listProjectRows(trx);
    const taken = new Set(existing.map((project) => project.key));
    const at = ctx.now();
    const project: ProjectRow = {
      id: randomUUID(),
      name: input.name,
      key: uniquePrefix(resolvePrefix(input.key ?? '', input.name), taken),
      description: input.description ?? '',
      repo: input.repo ?? '',
      color: PROJECT_COLORS[existing.length % PROJECT_COLORS.length] ?? PROJECT_COLORS[0],
      nextNum: 1,
      createdAt: at,
      updatedAt: at,
    };
    const statuses = defaultStatuses(project.id, at);
    await insertProject(trx, project);
    await insertStatuses(trx, statuses);
    return { project: toProject(project), statuses: statuses.map(toStatus) };
  });
  notify(ctx, detail.project.id);
  return detail;
}

export async function getProjectDetail(ctx: ServiceContext, key: string): Promise<ProjectDetail> {
  const project = await requireProject(ctx.db, key);
  const statuses = await listStatusRows(ctx.db, project.id);
  return { project: toProject(project), statuses: statuses.map(toStatus) };
}

export async function updateProject(
  ctx: ServiceContext,
  key: string,
  input: UpdateProjectValues,
): Promise<Project> {
  const outcome = await inTransaction(ctx, async (trx) => {
    const project = await requireProject(trx, key);
    const edits = changedFields(project, input);
    if (isEmpty(edits)) return { project, changed: false };
    const changes = { ...edits, updatedAt: ctx.now() };
    await updateProjectRow(trx, project.id, changes);
    return { project: { ...project, ...changes }, changed: true };
  });
  if (outcome.changed) notify(ctx, outcome.project.id);
  return toProject(outcome.project);
}

export async function deleteProject(ctx: ServiceContext, key: string): Promise<void> {
  const removed = await inTransaction(ctx, async (trx) => {
    const project = await requireProject(trx, key);
    const files = await storageKeysOfProject(trx, project.id);
    // Tickets go first: their status foreign key restricts deleting statuses that are in use.
    await deleteProjectTickets(trx, project.id);
    await deleteProjectRow(trx, project.id);
    return { project, files };
  });
  await removeFiles(ctx.storage, removed.files);
  notify(ctx, removed.project.id);
}
