import { AutostartError } from './errors';
import type { HelperJob } from './job';
import { macAutostart } from './mac';
import { linuxAutostart } from './systemd/linux';

export interface Installed {
  starts: string;
  notes: readonly (string | undefined)[];
}

export interface Autostart {
  isInstalled(label: string): boolean;
  installedUrl(label: string): string | undefined;
  runningPid(label: string): number | undefined;
  statusLines(label: string): string[];
  install(job: HelperJob): Installed;
  uninstall(label: string): boolean;
}

export function autostartOn(platform: NodeJS.Platform = process.platform): Autostart | undefined {
  if (platform === 'darwin') return macAutostart;
  if (platform === 'linux') return linuxAutostart();
  return undefined;
}

export function requireAutostart(platform: NodeJS.Platform = process.platform): Autostart {
  const autostart = autostartOn(platform);
  if (!autostart) throw new AutostartError('Starting by itself works on macOS and Linux only.');
  return autostart;
}
