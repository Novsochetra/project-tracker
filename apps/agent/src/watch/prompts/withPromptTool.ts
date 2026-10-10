import type { Run } from '@tracker/shared';
import type { Env } from '../../config';
import type { AskPerson } from './askPerson';
import { deny, promptCallOf } from './promptCall';
import { openPromptSocket } from './promptSocket';
import { promptToolArgs, promptToolEnv } from './promptToolArgs';

export interface PromptTool {
  command: readonly string[];
  ask: AskPerson;
}

export interface PromptToolRun {
  args: string[];
  env: Env | undefined;
}

// No prompt tool: Claude gets no way to ask, as an Ask or Plan question must not.
export const NO_PROMPT_TOOL: PromptToolRun = { args: [], env: undefined };

// The run's own socket, open while Claude runs, so a call can only ever ask in this run.
export async function withPromptTool<T>(
  tool: PromptTool,
  run: Run,
  start: (prompts: PromptToolRun) => Promise<T>,
): Promise<T> {
  const socket = await openPromptSocket((args, signal) => {
    const call = promptCallOf(args);
    return call
      ? tool.ask(run, call, signal)
      : Promise.resolve(deny('The call could not be read.'));
  });
  try {
    return await start({
      args: promptToolArgs(tool.command, socket.path),
      env: promptToolEnv(process.env),
    });
  } finally {
    socket.close();
  }
}
