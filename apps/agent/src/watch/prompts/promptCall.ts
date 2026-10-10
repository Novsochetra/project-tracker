import { isJson } from '@tracker/shared';

export interface PromptCall {
  toolName: string;
  input: Readonly<Record<string, unknown>>;
}

// Claude Code reads exactly this shape (the Agent SDK's canUseTool answer) from the tool's text.
export type PromptDecision =
  | { behavior: 'allow'; updatedInput: Readonly<Record<string, unknown>> }
  | { behavior: 'deny'; message: string };

export function promptCallOf(args: unknown): PromptCall | null {
  if (!isJson(args) || typeof args.tool_name !== 'string') return null;
  return { toolName: args.tool_name, input: isJson(args.input) ? args.input : {} };
}

export const deny = (message: string): PromptDecision => ({ behavior: 'deny', message });
