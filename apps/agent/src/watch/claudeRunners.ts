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
import { questionsOnly } from './permissionTool/questionsOnly';
import { withPromptTool, type PromptTool } from './permissionTool/withPromptTool';

export type OnSteps = (steps: RunStepInput[]) => void;
type StepReader = (event: unknown) => RunStepInput[];

export interface ClaudeSetup {
  command: string;
  cwd: string;
  permissionMode?: string | undefined;
  maxTurns?: string | undefined;
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
  // Every run, questions too: a cap on what any one run can take.
  const limit = setup.maxTurns ? ['--max-turns', setup.maxTurns] : [];
  // A reader a run: it remembers that run's open tool calls.
  const onEvent = (onSteps: OnSteps) => stepsOf(readSteps(cwd), onSteps);
  // Every run may ask the person (PT-230). Only runs of the ticket lane, the ones that may change
  // the folder, get the tracker tools and may ask for a permission; an Ask or Plan question may only
  // ask questions, so no answer can widen what it may do.
  const asking = (run: Run, start: (laneArgs: string[]) => Promise<ClaudeExit>) => {
    const changesFolder = laneOf(run.kind, run.askOptions) === 'ticket';
    const allowed = changesFolder ? trackerAllowedArgs(run) : [];
    if (!prompts) return start(allowed);
    const tool = changesFolder ? prompts : questionsOnly(prompts);
    return withPromptTool(tool, run, (promptArgs) => start([...allowed, ...promptArgs]));
  };
  return {
    runClaude: (job: RunJob, stop: AbortSignal, onSteps: OnSteps) =>
      asking(job.run, (laneArgs) =>
        runClaude(
          { command, cwd, args: [...claudeArgs(permissionMode), ...limit, ...laneArgs] },
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
              args: [...askArgs(job, permissionMode), ...limit, ...laneArgs, ...addDirArgs(folder)],
            },
            withSentFiles(job.prompt, folder?.paths ?? []),
            stop,
            { onOutput: () => undefined, onEvent: onEvent(onSteps) },
          ),
        ),
      ),
  };
}
