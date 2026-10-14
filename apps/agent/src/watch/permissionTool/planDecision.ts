import { planModeOf, type PlanMode, type RunRequest } from '@tracker/shared';
import { deny, type PromptDecision } from './promptCall';

const MODE_NAMES: Readonly<Record<PlanMode, string>> = { edit: 'Edit', auto: 'Auto' };

// Allowing the call would take this process out of plan mode, and the chat keeps it for its next
// Plan question (PT-238); the tracker carries the plan out in a new turn in the mode the person
// picked instead.
export const planApproved = (mode: PlanMode): string =>
  `The person approved your plan on their phone. The tracker carries it out in a new turn right after this one, in ${MODE_NAMES[mode]} mode. Don't start on it now: say in one short line that the plan is approved, and end your turn.`;

export const KEEP_PLANNING =
  'The person wants to keep planning. Stay in plan mode: ask them what to change, and end your turn.';

export const keepPlanningWith = (note: string): string =>
  `The person wants to keep planning, with this note:\n\n${note}\n\nStay in plan mode, change the plan to fit it, and call ExitPlanMode again with the new plan.`;

export function planDecision(request: RunRequest): PromptDecision {
  const mode = request.decision === 'allow' ? planModeOf(request.answers) : null;
  if (mode) return deny(planApproved(mode));
  const note = request.answers?.[0];
  return deny(note ? keepPlanningWith(note) : KEEP_PLANNING);
}
