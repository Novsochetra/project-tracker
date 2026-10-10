import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPromptToolServer } from './watch/prompts/promptToolServer';

// tracker watch starts Claude Code with this as its permission prompt tool, one per run, with the
// helper's socket as the only argument. stdout carries the MCP protocol.
const [socketPath] = process.argv.slice(2);
if (!socketPath) {
  console.error('tracker prompt tool: start it from tracker watch.');
  process.exit(1);
}
await createPromptToolServer(socketPath).connect(new StdioServerTransport());
