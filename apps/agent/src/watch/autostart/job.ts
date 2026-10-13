import { realpathSync } from 'node:fs';
import { DEFAULT_AGENT_NAME, type Config } from '../../config';
import type { WatchArgs } from '../watchIo';
import { AutostartError } from './errors';
import { labelFor, logPathOf } from './names';
import type { LaunchAgent } from './plist';

const SAFE_PROJECT_KEY = /^[A-Z0-9]{1,20}$/;

export interface JobInput {
  config: Config;
  configPath: string;
  folder: string;
  projectKey: string;
  args: WatchArgs;
  env: Readonly<Record<string, string | undefined>>;
}

// The key can come from the tracker's project list; one shaped like a flag must not reach argv.
function projectKeyOf(key: string): string {
  if (!SAFE_PROJECT_KEY.test(key)) throw new AutostartError(`"${key}" isn't a project key.`);
  return key;
}

// One argument each, so a value that starts with "-" can't be read as a flag.
const option = (name: string, value: string | undefined): string[] =>
  value ? [`--${name}=${value}`] : [];

export const watchArgsFor = ({ config, projectKey, args }: JobInput): string[] => [
  'watch',
  ...option('url', config.url),
  ...option('as', config.agentName === DEFAULT_AGENT_NAME ? undefined : config.agentName),
  ...option('name', args.name),
  ...option('permission-mode', args.permissionMode),
  ...option('max-turns', args.maxTurns),
  ...(args.keepAwake === false ? ['--no-keep-awake'] : []),
  projectKeyOf(projectKey),
];

// Through env, so the job still finds node after an upgrade moves node's own folder.
export const thisCli = (): string[] => [
  '/usr/bin/env',
  'node',
  ...process.execArgv,
  realpathSync(process.argv[1] ?? ''),
];

export function jobFor(input: JobInput, cli: readonly string[] = thisCli()): LaunchAgent {
  const label = labelFor(input.folder);
  return {
    label,
    program: [...cli, ...watchArgsFor(input)],
    folder: input.folder,
    logPath: logPathOf(label),
    environment: { PATH: input.env.PATH ?? '', TRACKER_CONFIG: input.configPath },
  };
}
