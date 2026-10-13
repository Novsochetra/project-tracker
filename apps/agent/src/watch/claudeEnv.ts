import { RUN_REQUEST_DEADLINE_MS } from '@tracker/shared';

// A question's 30 minutes, with room for ask_person's own minute past it.
export const ASK_PERSON_CALL_MS = RUN_REQUEST_DEADLINE_MS + 5 * 60_000;

// Claude Code ends an MCP call that runs past MCP_TOOL_TIMEOUT. Its default (about 28 hours) is far
// past a question's wait, so only a shorter one the person set is raised, for the runs it starts.
export function claudeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const set = Number(env.MCP_TOOL_TIMEOUT);
  if (!env.MCP_TOOL_TIMEOUT || !(set < ASK_PERSON_CALL_MS)) return env;
  return { ...env, MCP_TOOL_TIMEOUT: String(ASK_PERSON_CALL_MS) };
}
