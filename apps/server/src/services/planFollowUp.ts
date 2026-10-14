import { PLAN_FOLLOW_UP, planModeOf, takesPlans, type PlanMode } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { AppError } from '../errors';
import { listRunRequestRows } from '../repositories/runRequests';
import type { RunWithKey } from '../repositories/runs';
import { askInChat } from './chats';
import type { ServiceContext } from './context';
import { sayPlanNotStarted } from './planNotStarted';
import { toRunRequest } from './runRequestMappers';

interface ApprovedPlan {
  mode: PlanMode;
  plan: string;
}

// Only the run's last plan can be carried out: one Claude made after an approval is a plan the
// person never approved.
async function approvedPlan(ctx: ServiceContext, runId: string): Promise<ApprovedPlan | null> {
  const rows = await listRunRequestRows(ctx.db, runId);
  const last = rows.filter((row) => row.kind === 'plan').at(-1);
  if (last?.status !== 'answered' || last.decision !== 'allow') return null;
  const mode = planModeOf(toRunRequest(last).answers);
  return mode ? { mode, plan: last.label } : null;
}

const isPlanRun = (run: RunWithKey): boolean =>
  run.status === 'done' && takesPlans(run.kind, run.askMode);

async function queueFollowUp(ctx: ServiceContext, scope: UserScope, run: RunWithKey) {
  const { chatId, runnerId } = run;
  if (!isPlanRun(run) || !chatId || !runnerId) return;
  const approved = await approvedPlan(ctx, run.id);
  if (!approved) return;
  // Claude's answer was saved at the run's end, often in this same millisecond, and the chat
  // orders its messages by time.
  const after = { ...ctx, now: () => Math.max(ctx.now(), (run.endedAt ?? 0) + 1) };
  const input = { runnerId, text: PLAN_FOLLOW_UP, attachmentIds: [], ...approved };
  try {
    await askInChat(after, scope, chatId, input);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    await sayPlanNotStarted(after, chatId, error.message);
  }
}

// The mode is the person's pick on the plan's card, saved when they answered it; the helper only
// says the turn ended. A Plan question's Claude can't leave plan mode in its own process, so the
// plan is carried out as the chat's next question (PT-235). The run's end is saved already, so
// nothing here may fail the helper's finish.
export function carryOutApprovedPlan(
  ctx: ServiceContext,
  scope: UserScope,
  run: RunWithKey,
): Promise<void> {
  return queueFollowUp(ctx, scope, run).catch((error: unknown) => {
    console.warn(`The approved plan of run ${run.id} was not started:`, error);
  });
}
