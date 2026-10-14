import {
  PLAN_TOOL,
  planRequestOf,
  requestOfCall,
  takesPlans,
  type Run,
  type RunRequestInput,
} from '@tracker/shared';
import type { PromptCall } from './promptCall';

export const isPlanCall = (run: Run, call: PromptCall): boolean =>
  call.toolName === PLAN_TOOL && takesPlans(run.kind, run.askOptions?.mode);

export const requestOfRun = (run: Run, call: PromptCall, folder: string): RunRequestInput | null =>
  isPlanCall(run, call)
    ? planRequestOf(call.input)
    : requestOfCall(call.toolName, call.input, folder);
