import type { CancelRunRequestInput, RunRequest } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { forbidden } from '../errors';
import { markRequestCancelled } from '../repositories/runRequests';
import type { ServiceContext } from './context';
import { notifyRunRequest, toRunRequest } from './runRequestMappers';
import { requireRunRequest } from './runRequests';

// A request that already ended stays as it ended: the helper may give up just as the person
// answers, and the answer then stands.
export async function cancelRunRequest(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  { runnerId }: CancelRunRequestInput,
): Promise<RunRequest> {
  const { row, run } = await requireRunRequest(ctx, scope, id);
  if (run.runnerId !== runnerId) {
    throw forbidden('Only the helper that took this run ends its requests.');
  }
  const cancelled = await markRequestCancelled(ctx.db, row.id, ctx.now());
  const after = (await requireRunRequest(ctx, scope, id)).row;
  if (cancelled) notifyRunRequest(ctx, scope, run, after);
  return toRunRequest(after);
}
