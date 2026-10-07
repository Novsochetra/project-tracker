import type { z } from 'zod';
import type { TrackerApi } from '../../src/client';
import type { Tool, ToolReply } from '../../src/tools/tool';

// Parses like the MCP server and the CLI do, so normalization is covered too.
export const run = <Input extends z.ZodObject>(
  tool: Tool<Input>,
  client: TrackerApi,
  input: z.input<Input>,
): Promise<ToolReply> => tool.handler(client, tool.input.parse(input));
