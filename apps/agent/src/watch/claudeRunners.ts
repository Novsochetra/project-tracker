import {
  createStepReader,
  laneOf,
  withSentFiles,
  type Run,
  type RunJob,
  type RunStepInput,
} from '@tracker/shared';
import { askArgs } from './ask/askArgs';
import { addDirArgs, withAskFiles, type FetchFile } from './ask/askFiles';
import { claudeArgs, runClaude } from './claude';
import { trackerAllowedArgs } from './mcp/trackerAllowedTools';
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
  prompts?: PromptTool | undefined;
  fetchFile?: FetchFile | undefined;
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
  const { fetchFile } = setup;
  // A reader a run: it remembers that run's open tool calls.
  const onEvent = (onSteps: OnSteps) => stepsOf(readSteps(cwd), onSteps);
  // Only runs of the ticket lane, the ones that may change the folder, may ask the person: ticket
  // runs and Edit questions. An Ask or Plan question gets no prompt tool and no tracker tools, so
  // no answer can widen what it may do.
  const asking = (run: Run, start: (laneArgs: string[]) => Promise<ClaudeExit>) => {
    if (laneOf(run.kind, run.askOptions) !== 'ticket') return start([]);
    const allowed = trackerAllowedArgs(run);
    return prompts
      ? withPromptTool(prompts, run, (promptArgs) => start([...allowed, ...promptArgs]))
      : start(allowed);
  };
  return {
    runClaude: (job: RunJob, stop: AbortSignal, onSteps: OnSteps) =>
      asking(job.run, (laneArgs) =>
        runClaude(
          { command, cwd, args: [...claudeArgs(permissionMode), ...laneArgs] },
          job.prompt,
          stop,
          { onOutput: write, onEvent: onEvent(onSteps) },
        ),
      ),
    // An answer goes to the chat, not to this window.
    runAsk: (job: RunJob, stop: AbortSignal, onSteps: OnSteps) =>
      withAskFiles(fetchFile, { job, stop }, (folder) =>
        asking(job.run, (laneArgs) =>
          runClaude(
            {
              command,
              cwd,
              args: [...askArgs(job, permissionMode), ...laneArgs, ...addDirArgs(folder)],
            },
            withSentFiles(job.prompt, folder?.paths ?? []),
            stop,
            { onOutput: () => undefined, onEvent: onEvent(onSteps) },
          ),
        ),
      ),
  };
}
