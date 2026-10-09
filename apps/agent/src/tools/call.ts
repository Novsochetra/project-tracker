import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { TrackerApi } from '../client';
import { describeError } from '../errors';
import { imageContent } from './images';
import type { Tool } from './tool';

export async function callTool<Input extends z.ZodObject>(
  tool: Tool<Input>,
  client: TrackerApi,
  input: z.output<Input>,
): Promise<CallToolResult> {
  try {
    const reply = await tool.handler(client, input);
    const images = reply.images ? await imageContent(client, reply.images) : [];
    return { content: [{ type: 'text', text: reply.text }, ...images] };
  } catch (error) {
    return { content: [{ type: 'text', text: describeError(error, client) }], isError: true };
  }
}
