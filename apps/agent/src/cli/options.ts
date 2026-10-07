import type { ParseArgsConfig } from 'node:util';

export const GLOBAL_OPTIONS = {
  url: { type: 'string' },
  as: { type: 'string' },
  token: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const satisfies NonNullable<ParseArgsConfig['options']>;

export const COMMAND_OPTIONS = {
  title: { type: 'string' },
  description: { type: 'string' },
  priority: { type: 'string' },
  status: { type: 'string' },
  category: { type: 'string' },
  query: { type: 'string' },
  assignee: { type: 'string' },
  due: { type: 'string' },
  summary: { type: 'string' },
  files: { type: 'string' },
  next: { type: 'string' },
  verdict: { type: 'string' },
  rating: { type: 'string' },
} as const satisfies NonNullable<ParseArgsConfig['options']>;

export type CommandOption = keyof typeof COMMAND_OPTIONS;

export type CommandValues = Partial<Record<CommandOption, string>>;

export interface GlobalValues {
  url?: string;
  as?: string;
  token?: string;
  json: boolean;
  help: boolean;
}
