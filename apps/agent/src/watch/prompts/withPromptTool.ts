import type { Run } from '@tracker/shared';
import type { AskPerson } from './askPerson';
import { deny, promptCallOf } from './promptCall';
import { openPromptSocket } from './promptSocket';
import { promptToolArgs } from './promptToolArgs';

export interface PromptTool {
  command: readonly string[];
  ask: AskPerson;
}

// The run's own socket, open while Claude runs, so a call can only ever ask in this run.
export async function withPromptTool<T>(
  tool: PromptTool,
  run: Run,
  start: (promptArgs: string[]) => Promise<T>,
): Promise<T> {
  const socket = await openPromptSocket((args, signal) => {
    const call = promptCallOf(args);
    return call
      ? tool.ask(run, call, signal)
      : Promise.resolve(deny('The call could not be read.'));
  });
  try {
    return await start(promptToolArgs(tool.command, socket.path));
  } finally {
    socket.close();
  }
}
