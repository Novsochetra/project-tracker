import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../../config';
import { AutostartError } from './errors';

export function requireMac(): void {
  if (process.platform !== 'darwin') {
    throw new AutostartError('Starting by itself works on macOS only so far.');
  }
}

// The job doesn't get this shell's variables, so a token from one is missing at login, and while
// the variable is set it wins over the saved token.
export function refuseTokenFromEnv(config: Config): void {
  if (!config.tokenSource || config.tokenSource === 'tracker login') return;
  const drop =
    config.tokenSource === '--token' ? 'Leave out --token' : `Unset ${config.tokenSource}`;
  throw new AutostartError(
    `${drop}, run "tracker login --url ${config.url}", then install again: the helper started at login won't have that token.`,
  );
}

const GUARDED_FOLDERS = ['Documents', 'Desktop', 'Downloads'];

export function privacyNote(
  paths: readonly string[],
  home: string = homedir(),
): string | undefined {
  const guarded = GUARDED_FOLDERS.filter((name) =>
    paths.some((path) => path.startsWith(join(home, name) + '/')),
  );
  if (guarded.length === 0) return undefined;
  const where = guarded.join(' and ');
  return `This folder or the tracker CLI is in ${where}, which macOS guards. Started at login, node has to be allowed in System Settings → Privacy & Security → Files and Folders (or Full Disk Access), and again after a node upgrade. Keeping both outside ${where}, like in ~/code, avoids that.`;
}
