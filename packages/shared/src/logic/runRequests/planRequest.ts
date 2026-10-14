import type { AskMode } from '../../domain/askOptions';
import type { RunKind } from '../../domain/run';
import {
  PLAN_MODES,
  RUN_PLAN_MAX,
  type PlanMode,
  type RunRequestInput,
} from '../../domain/runRequest';
import { isJson } from '../json';
import { cutTo } from '../runSteps/cut';

export const PLAN_TOOL = 'ExitPlanMode';
export const PLAN_FOLLOW_UP = 'Carry out the approved plan.';
export const NO_PLAN_TEXT = 'Claude is done planning but sent no plan.';

// Only a Plan question's Claude stays in plan mode for its whole process, so only its plan waits
// for the person; any other run that planned asks to leave plan mode like any permission.
export const takesPlans = (kind: RunKind, mode: AskMode | null | undefined): boolean =>
  kind === 'ask' && mode === 'plan';

// Claude Code puts the plan file's text in the call's `plan`, as it does for the desktop app.
export function planRequestOf(input: unknown): RunRequestInput {
  const plan = isJson(input) && typeof input.plan === 'string' ? input.plan.trim() : '';
  const text = plan || NO_PLAN_TEXT;
  const label = cutTo(text, RUN_PLAN_MAX);
  return { kind: 'plan', label, labelCut: label !== text, questions: null };
}

// Quoted, so no line of the plan reads as the prompt's own; it is in the prompt so the plan is
// carried out even when the session that made it can't be resumed.
export const approvedPlanBlock = (plan: string): string =>
  `The plan they approved:\n\n${plan
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')}`;

const isPlanMode = (value: unknown): value is PlanMode => PLAN_MODES.some((mode) => mode === value);

export function planModeOf(answers: readonly string[] | null | undefined): PlanMode | null {
  const [mode] = answers ?? [];
  return answers?.length === 1 && isPlanMode(mode) ? mode : null;
}
