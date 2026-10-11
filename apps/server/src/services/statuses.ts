import { randomUUID } from 'node:crypto';
import {
  DEFAULT_STATUSES,
  STATUS_COLORS,
  findStatusByName,
  type Actor,
  type createStatusInput,
  type Status,
  type StatusCategory,
  type updateStatusInput,
} from '@tracker/shared';
import type { z } from 'zod';
import type { Db, StatusRow } from '../db/schema';
import { conflict, invalidInput } from '../errors';
import { updateProjectRow } from '../repositories/projects';
import {
  deleteStatusRow,
  insertStatuses,
  listStatusRows,
  updateStatusRow,
} from '../repositories/statuses';
import { changedFields, isEmpty } from '../util';
import { inTransaction, notify, type ServiceContext, type UserContext } from './context';
import { requireProject, requireStatus } from './lookups';
import { toStatus } from './mappers';
import { moveGroupToEnd } from './statusMoves';

type CreateStatusValues = z.output<typeof createStatusInput>;
type UpdateStatusValues = z.output<typeof updateStatusInput>;

const defaultColor = (category: StatusCategory): string =>
  DEFAULT_STATUSES.find((template) => template.category === category)?.color ?? STATUS_COLORS[0];

const nextPosition = (statuses: readonly StatusRow[]): number =>
  statuses.reduce((max, status) => Math.max(max, status.position + 1), 0);

function assertUniqueName(statuses: readonly StatusRow[], name: string, exceptId?: string): void {
  const clash = findStatusByName(statuses, name);
  if (clash && clash.id !== exceptId) {
    throw conflict(`A status named “${clash.name}” already exists.`);
  }
}

async function touchProject(ctx: ServiceContext, trx: Db, projectId: string): Promise<void> {
  await updateProjectRow(trx, projectId, { updatedAt: ctx.now() });
}

export async function createStatus(
  ctx: UserContext,
  projectKey: string,
  input: CreateStatusValues,
): Promise<Status> {
  const status = await inTransaction(ctx, async (trx) => {
    const project = await requireProject(trx, ctx.scope, projectKey);
    const statuses = await listStatusRows(trx, project.id);
    assertUniqueName(statuses, input.name);
    const row: StatusRow = {
      id: randomUUID(),
      projectId: project.id,
      name: input.name,
      category: input.category,
      color: input.color ?? defaultColor(input.category),
      position: nextPosition(statuses),
      createdAt: ctx.now(),
    };
    await insertStatuses(trx, [row]);
    await touchProject(ctx, trx, project.id);
    return row;
  });
  notify(ctx, status.projectId);
  return toStatus(status);
}

export async function updateStatus(
  ctx: UserContext,
  id: string,
  input: UpdateStatusValues,
): Promise<Status> {
  const outcome = await inTransaction(ctx, async (trx) => {
    const current = await requireStatus(trx, ctx.scope, id);
    const changes = changedFields(current, input);
    if (isEmpty(changes)) return { status: current, changed: false };
    if (changes.name !== undefined) {
      assertUniqueName(await listStatusRows(trx, current.projectId), changes.name, id);
    }
    await updateStatusRow(trx, id, changes);
    await touchProject(ctx, trx, current.projectId);
    return { status: { ...current, ...changes }, changed: true };
  });
  if (outcome.changed) notify(ctx, outcome.status.projectId);
  return toStatus(outcome.status);
}

export async function reorderStatuses(
  ctx: UserContext,
  projectKey: string,
  ids: readonly string[],
): Promise<Status[]> {
  const result = await inTransaction(ctx, async (trx) => {
    const project = await requireProject(trx, ctx.scope, projectKey);
    const known = new Set((await listStatusRows(trx, project.id)).map((status) => status.id));
    const exact = ids.length === known.size && new Set(ids).size === ids.length;
    if (!exact || !ids.every((id) => known.has(id))) {
      throw invalidInput('Send every status of this project exactly once.');
    }
    for (const [position, id] of ids.entries()) await updateStatusRow(trx, id, { position });
    await touchProject(ctx, trx, project.id);
    return { projectId: project.id, statuses: await listStatusRows(trx, project.id) };
  });
  notify(ctx, result.projectId);
  return result.statuses.map(toStatus);
}

function moveTarget(statuses: readonly StatusRow[], deleted: StatusRow, moveTo?: string) {
  if (!moveTo) throw conflict('This status has tickets. Choose a status to move them to.');
  const target = statuses.find((status) => status.id === moveTo && status.id !== deleted.id);
  if (!target) throw invalidInput('Choose another status of this project for its tickets.');
  return target;
}

export async function deleteStatus(
  ctx: UserContext,
  actor: Actor,
  id: string,
  moveTo?: string,
): Promise<void> {
  const status = await inTransaction(ctx, async (trx) => {
    const current = await requireStatus(trx, ctx.scope, id);
    const statuses = await listStatusRows(trx, current.projectId);
    if (statuses.length <= 1) throw conflict('A project needs at least one status.');
    await moveGroupToEnd(trx, ctx.now, actor, {
      from: current,
      to: () => moveTarget(statuses, current, moveTo),
    });
    await deleteStatusRow(trx, id);
    await touchProject(ctx, trx, current.projectId);
    return current;
  });
  notify(ctx, status.projectId);
}
