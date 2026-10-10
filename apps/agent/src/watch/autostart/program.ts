import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { WatchArgs } from '../watchIo';

export const logPathFor = (projectKey: string): string =>
  join(homedir(), 'Library', 'Logs', `project-tracker-watch-${projectKey}.log`);

export const watchArgsFor = (projectKey: string, url: string, args: WatchArgs): string[] => [
  'watch',
  projectKey,
  '--url',
  url,
  ...(args.name ? ['--name', args.name] : []),
  ...(args.permissionMode ? ['--permission-mode', args.permissionMode] : []),
  ...(args.keepAwake === false ? ['--no-keep-awake'] : []),
];

// The job starts the CLI the way this one was started, a TypeScript loader included.
export const thisCli = (): string[] => [
  process.execPath,
  ...process.execArgv,
  realpathSync(process.argv[1] ?? ''),
];
