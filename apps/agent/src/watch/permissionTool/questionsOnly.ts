import { QUESTION_TOOL } from '@tracker/shared';
import { deny } from './promptCall';
import type { PromptTool } from './withPromptTool';

export const READ_ONLY_REFUSAL =
  'This is a read-only question (Ask or Plan). Say what you would do; the person can switch to Edit.';

// An Ask or Plan question may ask the person questions, never for a permission: one they allowed
// would let a read-only run change things.
export const questionsOnly = (tool: PromptTool): PromptTool => ({
  ...tool,
  ask: (run, call, signal) =>
    call.toolName === QUESTION_TOOL
      ? tool.ask(run, call, signal)
      : Promise.resolve(deny(READ_ONLY_REFUSAL)),
});
