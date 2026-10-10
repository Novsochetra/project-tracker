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

export const watchArgsFor = ({ config, projectKey, args }: JobInput): string[] => [
  'watch',
  '--url',
  config.url,
  ...(config.agentName === DEFAULT_AGENT_NAME ? [] : ['--as', config.agentName]),
  ...(args.name ? ['--name', args.name] : []),
  ...(args.permissionMode ? ['--permission-mode', args.permissionMode] : []),
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
