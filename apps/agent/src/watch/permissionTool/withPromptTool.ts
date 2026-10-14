import type { Run } from '@tracker/shared';
import type { AskPerson } from './askPerson';
import { deny, promptCallOf } from './promptCall';
import { openPromptSocket } from './promptSocket';
import { promptToolArgs } from './promptToolArgs';

export interface PromptTool {
  command: readonly string[];
  ask: AskPerson;
}

export interface OpenPromptTool {
  args: string[];
  close: () => void;
}

export const NO_RUN = 'No question is running in this chat.';

// A chat's Claude stays open for many runs (PT-238), so a call asks in whichever run is going on.
export async function openPromptTool(
  tool: PromptTool,
  runNow: () => Run | undefined,
): Promise<OpenPromptTool> {
  const socket = await openPromptSocket((args, signal) => {
    const call = promptCallOf(args);
    const run = runNow();
    if (!call) return Promise.resolve(deny('The call could not be read.'));
    return run ? tool.ask(run, call, signal) : Promise.resolve(deny(NO_RUN));
  });
  return { args: promptToolArgs(tool.command, socket.path), close: socket.close };
}

// The run's own socket, open while Claude runs, so a call can only ever ask in this run.
export async function withPromptTool<T>(
  tool: PromptTool,
  run: Run,
  start: (promptArgs: string[]) => Promise<T>,
): Promise<T> {
  const open = await openPromptTool(tool, () => run);
  try {
    return await start(open.args);
  } finally {
    open.close();
  }
}
