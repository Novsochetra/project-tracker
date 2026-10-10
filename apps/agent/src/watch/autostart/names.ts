import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const labelFor = (folder: string): string =>
  `com.project-tracker.watch.${createHash('sha256').update(folder).digest('hex').slice(0, 12)}`;

export const plistPathOf = (label: string): string =>
  join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);

export const logPathOf = (label: string): string =>
  join(homedir(), 'Library', 'Logs', `${label}.log`);
