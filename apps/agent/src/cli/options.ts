import type { ParseArgsConfig } from 'node:util';

export const GLOBAL_OPTIONS = {
  url: { type: 'string' },
  as: { type: 'string' },
  token: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
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
  name: { type: 'string' },
  'permission-mode': { type: 'string' },
  'max-turns': { type: 'string' },
} as const satisfies NonNullable<ParseArgsConfig['options']>;

export const WATCH_FLAGS = {
  install: { type: 'boolean' },
  uninstall: { type: 'boolean' },
  check: { type: 'boolean' },
  'no-keep-awake': { type: 'boolean' },
} as const satisfies NonNullable<ParseArgsConfig['options']>;

export type WatchFlag = keyof typeof WATCH_FLAGS;

export type WatchFlags = Partial<Record<WatchFlag, boolean>>;

export type CommandOption = keyof typeof COMMAND_OPTIONS;

export type CommandValues = Partial<Record<CommandOption, string>>;

export interface GlobalValues {
  url?: string;
  as?: string;
  token?: string;
  json: boolean;
  help: boolean;
  version: boolean;
}
