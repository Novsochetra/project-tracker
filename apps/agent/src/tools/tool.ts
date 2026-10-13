import type { Attachment } from '@tracker/shared';
import type { z } from 'zod';
import type { TrackerApi } from '../client';

export interface ToolReply {
  text: string;
  data: unknown;
  images?: readonly Attachment[];
}

// The MCP call a tool answers; the CLI runs a tool with no call.
export interface ToolCall {
  signal: AbortSignal;
}

export interface Tool<Input extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  input: Input;
  readOnly: boolean;
  handler(client: TrackerApi, input: z.output<Input>, call?: ToolCall): Promise<ToolReply>;
}

export const defineTool = <Input extends z.ZodObject>(tool: Tool<Input>): Tool<Input> => tool;
