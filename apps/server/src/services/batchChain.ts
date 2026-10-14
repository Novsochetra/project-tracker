import type { UserScope } from '../auth/scope';
import { findRunInScope } from '../repositories/runs';
import type { ServiceContext } from './context';
import { continueChain } from './reviewChain/continueChain';

// A batch's ticket run ends when its ticket reaches review, never in endRun, so it chains here,
// after the write that ended it is committed, as a run of its own does once its end is written.
export async function chainHeldTickets(
  ctx: ServiceContext,
  scope: UserScope,
  runIds: readonly string[],
): Promise<void> {
  for (const id of runIds) {
    const run = await findRunInScope(ctx.db, scope, id);
    if (run) await continueChain(ctx, run);
  }
}
