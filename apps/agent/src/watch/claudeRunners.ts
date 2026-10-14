import { createStepReader, type Run, type RunJob, type RunStepInput } from '@tracker/shared';
import { askArgs } from './ask/askArgs';
import { claudeArgs, runClaude } from './claude';
import type { ClaudeExit } from './outcome';
import { withPromptTool, type PromptTool } from './permissionTool/withPromptTool';

export type OnSteps = (steps: RunStepInput[]) => void;
type StepReader = (event: unknown) => RunStepInput[];

export interface ClaudeSetup {
  command: string;
  cwd: string;
  permissionMode?: string | undefined;
  write: (text: string) => void;
  readSteps?: ((folder: string) => StepReader) | undefined;
  prompts: PromptTool;
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
  const { command, cwd, permissionMode, write, readSteps = createStepReader, prompts } = setup;
  // A reader a run: it remembers that run's open tool calls.
  const onEvent = (onSteps: OnSteps) => stepsOf(readSteps(cwd), onSteps);
  // Every run may ask the person. An Ask or Plan question stays read-only: its --strict-mcp-config
  // still loads the prompt tool, which --mcp-config adds, and nothing else from the folder.
  const asking = (run: Run, start: (promptArgs: string[]) => Promise<ClaudeExit>) =>
    withPromptTool(prompts, run, start);
  return {
    runClaude: (job: RunJob, stop: AbortSignal, onSteps: OnSteps) =>
      asking(job.run, (promptArgs) =>
        runClaude(
          { command, cwd, args: [...claudeArgs(permissionMode), ...promptArgs] },
          job.prompt,
          stop,
          { onOutput: write, onEvent: onEvent(onSteps) },
        ),
      ),
    // An answer goes to the chat, not to this window.
    runAsk: (job: RunJob, stop: AbortSignal, onSteps: OnSteps) =>
      asking(job.run, (promptArgs) =>
        runClaude(
          { command, cwd, args: [...askArgs(job, permissionMode), ...promptArgs] },
          job.prompt,
          stop,
          { onOutput: () => undefined, onEvent: onEvent(onSteps) },
        ),
      ),
  };
}
