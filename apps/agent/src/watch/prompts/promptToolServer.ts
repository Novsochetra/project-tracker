import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { askHelper } from './askHelper';
import { keepCallAlive } from './keepCallAlive';

export const PROMPT_SERVER = 'tracker-watch';
export const PROMPT_TOOL = 'ask_person';

export function createPromptToolServer(socketPath: string): McpServer {
  const server = new McpServer({ name: PROMPT_SERVER, version: '0.0.0' });
  server.registerTool(
    PROMPT_TOOL,
    {
      description: 'Asks the person on their phone to allow a tool use or answer a question.',
      inputSchema: {
        tool_name: z.string(),
        input: z.record(z.string(), z.unknown()),
        tool_use_id: z.string().optional(),
      },
    },
    async (args, extra) => {
      const stop = keepCallAlive(extra._meta?.progressToken, extra.sendNotification);
      try {
        const decision = await askHelper(socketPath, args, extra.signal);
        return { content: [{ type: 'text', text: JSON.stringify(decision) }] };
      } finally {
        stop();
      }
    },
  );
  return server;
}
