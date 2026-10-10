import { dirname, extname, join } from 'node:path';
import { RUN_REQUEST_DEADLINE_MS } from '@tracker/shared';
import type { Env } from '../../config';
import { PROMPT_SERVER, PROMPT_TOOL } from './promptToolServer';

// Built beside the CLI (dist/promptTool.js), or its source under tsx, whose loader is in execArgv.
export const promptToolCommand = (
  execPath: string,
  execArgv: readonly string[],
  cliScript: string,
): string[] => [execPath, ...execArgv, join(dirname(cliScript), `promptTool${extname(cliScript)}`)];

// Only the helper's own command and its socket's path: nothing from the tracker becomes a flag.
// --mcp-config adds the server to the folder's own, the tracker's included.
export function promptToolArgs(command: readonly string[], socketPath: string): string[] {
  const [program, ...args] = command;
  const server = { type: 'stdio', command: program, args: [...args, socketPath] };
  return [
    '--mcp-config',
    JSON.stringify({ mcpServers: { [PROMPT_SERVER]: server } }),
    '--permission-prompt-tool',
    `mcp__${PROMPT_SERVER}__${PROMPT_TOOL}`,
  ];
}

const TOOL_TIMEOUT_MS = RUN_REQUEST_DEADLINE_MS + 5 * 60_000;

// Claude Code must not give up on the tool before the tracker's deadline ends the request; a
// longer timeout the person set stays.
export function promptToolEnv(env: Env): Env {
  const theirs = Number(env.MCP_TOOL_TIMEOUT);
  const timeout = Number.isFinite(theirs) && theirs > TOOL_TIMEOUT_MS ? theirs : TOOL_TIMEOUT_MS;
  return { ...env, MCP_TOOL_TIMEOUT: String(timeout) };
}
