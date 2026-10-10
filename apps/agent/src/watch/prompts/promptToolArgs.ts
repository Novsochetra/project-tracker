import { dirname, extname, join } from 'node:path';
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
