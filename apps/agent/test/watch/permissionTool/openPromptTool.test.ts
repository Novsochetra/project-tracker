import type { Run } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AskPerson } from '../../../src/watch/permissionTool/askPerson';
import { askHelper } from '../../../src/watch/permissionTool/askHelper';
import { NO_RUN, openPromptTool } from '../../../src/watch/permissionTool/withPromptTool';
import { askJob } from '../fakeTracker';

const call = { tool_name: 'Bash', input: { command: 'ls' }, tool_use_id: 't-1' };

const socketOf = (args: string[]): string => {
  const config = JSON.parse(args[1] ?? '{}') as {
    mcpServers: Record<string, { args: string[] }>;
  };
  return Object.values(config.mcpServers)[0]?.args.at(-1) ?? '';
};

// A chat's claude stays open across its messages (PT-238), so one socket serves many runs.
describe('openPromptTool', () => {
  it('asks in the run going on at the time of the call, and refuses a call between runs', async () => {
    const ask = vi.fn<AskPerson>(() => Promise.resolve({ behavior: 'deny', message: 'No.' }));
    let now: Run | undefined = askJob('r-1', 'c-1').run;
    const tool = await openPromptTool({ command: ['node', 'promptTool.js'], ask }, () => now);
    try {
      const path = socketOf(tool.args);
      await askHelper(path, call);
      now = askJob('r-2', 'c-1').run;
      await askHelper(path, call);
      expect(ask.mock.calls.map(([run]) => run.id)).toEqual(['r-1', 'r-2']);
      now = undefined;
      expect(await askHelper(path, call)).toEqual({ behavior: 'deny', message: NO_RUN });
      expect(ask).toHaveBeenCalledTimes(2);
    } finally {
      tool.close();
    }
  });
});
