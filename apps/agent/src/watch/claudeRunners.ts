import { stepsOfEvent, type RunJob, type RunStepInput } from '@tracker/shared';
import { askArgs } from './ask/askArgs';
import { claudeArgs, runClaude } from './claude';

export interface ClaudeSetup {
  command: string;
  cwd: string;
  permissionMode?: string | undefined;
  write: (text: string) => void;
}

export type OnSteps = (steps: RunStepInput[]) => void;

// The person's --permission-mode reaches ticket runs and Edit questions only; an Ask or Plan
// question always gets the read-only flags.
export function claudeRunners({ command, cwd, permissionMode, write }: ClaudeSetup) {
  const ticket = { command, cwd, args: claudeArgs(permissionMode) };
  const toSteps = (onSteps: OnSteps) => (event: unknown) => {
    const steps = stepsOfEvent(event, cwd);
    if (steps.length > 0) onSteps(steps);
  };
  return {
    runClaude: (prompt: string, stop: AbortSignal, onSteps: OnSteps) =>
      runClaude(ticket, prompt, stop, { onOutput: write, onEvent: toSteps(onSteps) }),
    // An answer goes to the chat, not to this window.
    runAsk: (job: RunJob, stop: AbortSignal, onSteps: OnSteps) =>
      runClaude({ command, cwd, args: askArgs(job, permissionMode) }, job.prompt, stop, {
        onOutput: () => undefined,
        onEvent: toSteps(onSteps),
      }),
  };
}
