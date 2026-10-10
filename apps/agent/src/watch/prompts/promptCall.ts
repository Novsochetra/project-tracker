export interface PromptCall {
  toolName: string;
  input: Readonly<Record<string, unknown>>;
}

// The SDK's canUseTool answer, which Claude Code reads from the prompt tool's text.
export type PromptDecision =
  | { behavior: 'allow'; updatedInput: Readonly<Record<string, unknown>> }
  | { behavior: 'deny'; message: string };

const isJson = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function promptCallOf(args: unknown): PromptCall | null {
  if (!isJson(args) || typeof args.tool_name !== 'string') return null;
  return { toolName: args.tool_name, input: isJson(args.input) ? args.input : {} };
}

export const deny = (message: string): PromptDecision => ({ behavior: 'deny', message });
