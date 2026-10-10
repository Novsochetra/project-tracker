import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPromptToolServer } from './watch/permissionTool/promptToolServer';

// stdout carries the MCP protocol, so nothing else may print there.
const [socketPath] = process.argv.slice(2);
if (!socketPath) {
  console.error('tracker prompt tool: start it from tracker watch.');
  process.exit(1);
}
await createPromptToolServer(socketPath).connect(new StdioServerTransport());
