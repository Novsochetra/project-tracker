import { createStepReader, type Run, type RunJob, type RunStepInput } from '@tracker/shared';
import type { FetchFile } from './ask/askFiles';
import { createChatRunner } from './chat/chatRunner';
import type { ChatPoolOptions } from './chat/chatPool';
import type { SpawnChat } from './chat/openChat';
import { claudeArgs, runClaude } from './claude';
import type { ClaudeExit } from './outcome';
import { runPermissions } from './permissionTool/runPermissions';
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
  chats?: ChatPoolOptions | undefined;
  spawnChat?: SpawnChat | undefined;
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
  // Every run, questions too: a cap on what any one run can take.
  const limit = setup.maxTurns ? ['--max-turns', setup.maxTurns] : [];
  // A reader a run: it remembers that run's open tool calls.
  const onEvent = (onSteps: OnSteps) => stepsOf(readSteps(cwd), onSteps);
  const asking = (run: Run, start: (laneArgs: string[]) => Promise<ClaudeExit>) => {
    const { allowed, tool } = runPermissions(run, prompts);
    if (!tool) return start(allowed);
    return withPromptTool(tool, run, (promptArgs) => start([...allowed, ...promptArgs]));
  };
  const chats = createChatRunner({
    command,
    cwd,
    permissionMode,
    limit,
    prompts,
    fetchFile: setup.fetchFile,
    pool: setup.chats,
    spawn: setup.spawnChat,
  });
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
      chats.ask(job, stop, onEvent(onSteps)),
    closeChats: chats.closeAll,
  };
}
