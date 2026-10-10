import { createStepReader, type RunJob, type RunStepInput } from '@tracker/shared';
import { askArgs } from './ask/askArgs';
import { claudeArgs, runClaude } from './claude';

export type OnSteps = (steps: RunStepInput[]) => void;
type StepReader = (event: unknown) => RunStepInput[];

export interface ClaudeSetup {
  command: string;
  cwd: string;
  permissionMode?: string | undefined;
  write: (text: string) => void;
  readSteps?: ((folder: string) => StepReader) | undefined;
}

// Runs inside stdout's listener, where a throw would end the helper mid-run; steps only show what
// Claude does, so an event that can't be read is dropped.
function stepsOf(read: StepReader, onSteps: OnSteps) {
  return (event: unknown) => {
    try {
      const steps = read(event);
      if (steps.length > 0) onSteps(steps);
    } catch {
      return;
    }
  };
}

// The person's --permission-mode reaches ticket runs and Edit questions only; an Ask or Plan
// question always gets the read-only flags.
export function claudeRunners(setup: ClaudeSetup) {
  const { command, cwd, permissionMode, write, readSteps = createStepReader } = setup;
  const ticket = { command, cwd, args: claudeArgs(permissionMode) };
  // A reader a run: it remembers that run's open tool calls.
  const onEvent = (onSteps: OnSteps) => stepsOf(readSteps(cwd), onSteps);
  return {
    runClaude: (prompt: string, stop: AbortSignal, onSteps: OnSteps) =>
      runClaude(ticket, prompt, stop, { onOutput: write, onEvent: onEvent(onSteps) }),
    // An answer goes to the chat, not to this window.
    runAsk: (job: RunJob, stop: AbortSignal, onSteps: OnSteps) =>
      runClaude({ command, cwd, args: askArgs(job, permissionMode) }, job.prompt, stop, {
        onOutput: () => undefined,
        onEvent: onEvent(onSteps),
      }),
  };
}
