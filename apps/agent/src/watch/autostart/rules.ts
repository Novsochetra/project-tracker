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
  throw new AutostartError(
    `The token comes from ${config.tokenSource}. Unset it, run "tracker login --url ${config.url}", then install again.`,
  );
}

const GUARDED_FOLDERS = ['Documents', 'Desktop', 'Downloads'];

export function privacyNote(folder: string, home: string = homedir()): string | undefined {
  const guarded = GUARDED_FOLDERS.find((name) => folder.startsWith(join(home, name) + '/'));
  return (
    guarded &&
    `This folder is in ${guarded}, which macOS guards. Started at login, node has to be allowed in System Settings → Privacy & Security → Files and Folders (or Full Disk Access), and again after a node upgrade. A folder outside ${guarded}, like ~/code, avoids that.`
  );
}
