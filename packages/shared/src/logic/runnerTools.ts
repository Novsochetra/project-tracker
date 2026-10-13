import type { Runner, RunnerTools } from '../domain/run';

// Claude Code starts commands and skills the same way, with a slash.
export function toolNames(tools: RunnerTools | null): string[] {
  if (!tools) return [];
  const slashed = [...tools.commands, ...tools.skills].map((name) => `/${name}`);
  return [...new Set([...tools.servers, ...slashed])];
}

export const toolsText = (tools: RunnerTools | null): string => toolNames(tools).join(', ');

export const helperLabel = ({ name, tools }: Pick<Runner, 'name' | 'tools'>): string =>
  [name, toolsText(tools)].filter(Boolean).join(' · ');
