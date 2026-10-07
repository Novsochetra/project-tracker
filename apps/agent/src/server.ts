import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TrackerApi } from './client';
import { PROMPTS } from './prompts';
import type { PromptDefinition } from './prompts/prompt';
import { TOOLS } from './tools';
import { callTool } from './tools/call';
import type { Tool } from './tools/tool';

export const SERVER_NAME = 'tracker';

const INSTRUCTIONS =
  "The user's project tracker. Tickets move To do → In progress → Need review → Reviewed → Done. " +
  'Workers: claim_next_ticket (or claim_ticket), do the work, add_comment for decisions and blockers, then ' +
  'submit_for_review. Reviewers: list_tickets with category "in_review", get_ticket, verify the changes, then ' +
  'review_ticket. Agents never move tickets to Done; only a person does.';

function registerTool(server: McpServer, tool: Tool, client: TrackerApi): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.input,
      annotations: { readOnlyHint: tool.readOnly },
    },
    (input) => callTool(tool, client, input),
  );
}

function registerPrompt(server: McpServer, prompt: PromptDefinition): void {
  server.registerPrompt(
    prompt.name,
    {
      title: prompt.title,
      description: prompt.description,
      argsSchema: { project: z.string().optional().describe('Project key, e.g. MOB.') },
    },
    ({ project }) => ({
      description: prompt.description,
      messages: [{ role: 'user', content: { type: 'text', text: prompt.text(project) } }],
    }),
  );
}

export function createMcpServer(client: TrackerApi): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: '0.0.0' },
    { instructions: INSTRUCTIONS },
  );
  for (const tool of TOOLS) registerTool(server, tool, client);
  for (const prompt of PROMPTS) registerPrompt(server, prompt);
  return server;
}
