import type { AddRunChangesInput } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import { conflict, forbidden } from '../../errors';
import { saveRunChanges } from '../../repositories/runChanges';
import { forUser, notify, type ServiceContext } from '../context';
import { requireRun } from '../runs';

// The helper sends a ticket run's changes after Claude exits and before it ends the run, so they
// arrive only while the run is running, like its steps.
export async function addRunChanges(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: AddRunChangesInput,
): Promise<void> {
  const run = await requireRun(ctx, scope, id);
  if (run.runnerId !== input.runnerId) {
    throw forbidden('Only the helper that took this run sends its changes.');
  }
  if (run.kind !== 'ticket' || run.ticketId === null) {
    throw conflict('Only a ticket run keeps its changes.');
  }
  if (run.status !== 'running') throw conflict(`This run is not running (${run.status}).`);
  await saveRunChanges(ctx.db, {
    runId: run.id,
    ticketId: run.ticketId,
    diff: input.diff,
    cut: input.cut ? 1 : 0,
    verdict: null,
    createdAt: ctx.now(),
  });
  notify(forUser(ctx, scope), run.projectId, run.ticketId);
}
