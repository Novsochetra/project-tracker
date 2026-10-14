import { PLAN_FOLLOW_UP, planModeOf, takesPlans, type PlanMode } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { AppError } from '../errors';
import { listRunRequestRows } from '../repositories/runRequests';
import type { RunWithKey } from '../repositories/runs';
import { askInChat } from './chats';
import type { ServiceContext } from './context';
import { toRunRequest } from './runRequestMappers';

// Only the run's last plan can be carried out: one Claude made after an approval is a plan the
// person never approved.
async function approvedMode(ctx: ServiceContext, runId: string): Promise<PlanMode | null> {
  const rows = await listRunRequestRows(ctx.db, runId);
  const last = rows.filter((row) => row.kind === 'plan').at(-1);
  if (last?.status !== 'answered' || last.decision !== 'allow') return null;
  return planModeOf(toRunRequest(last).answers);
}

// The mode is the person's pick on the plan's card, saved when they answered it; the helper only
// says the turn ended. A Plan question's Claude can't leave plan mode in its own process, so the
// plan is carried out as the chat's next question (PT-235).
export async function carryOutApprovedPlan(
  ctx: ServiceContext,
  scope: UserScope,
  run: RunWithKey,
): Promise<void> {
  const { chatId, runnerId } = run;
  if (run.status !== 'done' || !takesPlans(run.kind, run.askMode) || !chatId || !runnerId) return;
  const mode = await approvedMode(ctx, run.id);
  if (!mode) return;
  // Claude's answer was saved at the run's end, often in this same millisecond, and the chat
  // orders its messages by time.
  const after = { ...ctx, now: () => Math.max(ctx.now(), (run.endedAt ?? 0) + 1) };
  try {
    await askInChat(after, scope, chatId, {
      runnerId,
      text: PLAN_FOLLOW_UP,
      mode,
      attachmentIds: [],
    });
  } catch (error) {
    // A helper gone offline or a chat deleted meanwhile leaves the plan approved but not started;
    // the run's own end must still be saved.
    if (!(error instanceof AppError)) throw error;
  }
}
