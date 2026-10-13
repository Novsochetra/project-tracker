import { randomUUID } from 'node:crypto';
import {
  findLabelByName,
  STATUS_COLORS,
  type createLabelInput,
  type Label,
  type updateLabelInput,
} from '@tracker/shared';
import type { z } from 'zod';
import type { LabelRow } from '../db/labelTables';
import type { Db } from '../db/schema';
import { conflict, invalidInput } from '../errors';
import { updateProjectRow } from '../repositories/projects';
import { deleteLabelRow, insertLabel, listLabelRows, updateLabelRow } from '../repositories/labels';
import { changedFields, isEmpty } from '../util';
import { inTransaction, notify, type UserContext } from './context';
import { requireLabel, requireProject } from './lookups';
import { toLabel } from './mappers';

type CreateLabelValues = z.output<typeof createLabelInput>;
type UpdateLabelValues = z.output<typeof updateLabelInput>;

const nextPosition = (labels: readonly LabelRow[]): number =>
  labels.reduce((max, label) => Math.max(max, label.position + 1), 0);

function assertUniqueName(labels: readonly LabelRow[], name: string, exceptId?: string): void {
  const clash = findLabelByName(labels, name);
  if (clash && clash.id !== exceptId) {
    throw conflict(`A label named “${clash.name}” already exists.`);
  }
}

const touchProject = (ctx: UserContext, trx: Db, projectId: string) =>
  updateProjectRow(trx, projectId, { updatedAt: ctx.now() });

export async function createLabel(
  ctx: UserContext,
  projectKey: string,
  input: CreateLabelValues,
): Promise<Label> {
  const label = await inTransaction(ctx, async (trx) => {
    const project = await requireProject(trx, ctx.scope, projectKey);
    const labels = await listLabelRows(trx, project.id);
    assertUniqueName(labels, input.name);
    const row: LabelRow = {
      id: randomUUID(),
      projectId: project.id,
      name: input.name,
      color: input.color ?? STATUS_COLORS[labels.length % STATUS_COLORS.length] ?? STATUS_COLORS[0],
      template: input.template,
      instructions: input.instructions,
      position: nextPosition(labels),
      createdAt: ctx.now(),
    };
    await insertLabel(trx, row);
    await touchProject(ctx, trx, project.id);
    return row;
  });
  notify(ctx, label.projectId);
  return toLabel(label);
}

export async function updateLabel(
  ctx: UserContext,
  id: string,
  input: UpdateLabelValues,
): Promise<Label> {
  const outcome = await inTransaction(ctx, async (trx) => {
    const current = await requireLabel(trx, ctx.scope, id);
    const changes = changedFields(current, input);
    if (isEmpty(changes)) return { label: current, changed: false };
    if (changes.name !== undefined) {
      assertUniqueName(await listLabelRows(trx, current.projectId), changes.name, id);
    }
    await updateLabelRow(trx, id, changes);
    await touchProject(ctx, trx, current.projectId);
    return { label: { ...current, ...changes }, changed: true };
  });
  if (outcome.changed) notify(ctx, outcome.label.projectId);
  return toLabel(outcome.label);
}

export async function reorderLabels(
  ctx: UserContext,
  projectKey: string,
  ids: readonly string[],
): Promise<Label[]> {
  const result = await inTransaction(ctx, async (trx) => {
    const project = await requireProject(trx, ctx.scope, projectKey);
    const known = new Set((await listLabelRows(trx, project.id)).map((label) => label.id));
    const exact = ids.length === known.size && new Set(ids).size === ids.length;
    if (!exact || !ids.every((id) => known.has(id))) {
      throw invalidInput('Send every label of this project exactly once.');
    }
    for (const [position, id] of ids.entries()) await updateLabelRow(trx, id, { position });
    await touchProject(ctx, trx, project.id);
    return { projectId: project.id, labels: await listLabelRows(trx, project.id) };
  });
  notify(ctx, result.projectId);
  return result.labels.map(toLabel);
}

// Its tickets lose it with it (ticket_labels cascades); they keep everything else.
export async function deleteLabel(ctx: UserContext, id: string): Promise<void> {
  const label = await inTransaction(ctx, async (trx) => {
    const current = await requireLabel(trx, ctx.scope, id);
    await deleteLabelRow(trx, id);
    await touchProject(ctx, trx, current.projectId);
    return current;
  });
  notify(ctx, label.projectId);
}
