import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../../config';
import { FolderBusyError, lockFolder } from '../folderLock';
import { AutostartError } from './errors';

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

// An installed helper would only keep failing on the lock while another one runs; the installed
// job itself may hold it, since installing again boots it out.
export function requireFreeFolder(
  lockFolderPath: string,
  folder: string,
  installedPid: () => number | undefined,
): void {
  try {
    lockFolder(lockFolderPath, folder)();
  } catch (error) {
    if (error instanceof FolderBusyError && error.holder === installedPid()) return;
    throw error;
  }
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
