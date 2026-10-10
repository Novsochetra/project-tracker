import type { GlobalValues } from '../../cli/options';
import { canonicalPath } from '../paths';
import { setUp } from '../setup';
import type { WatchArgs, WatchIo } from '../watchIo';
import { installAgent, uninstallAgent } from './launchd';
import { labelFor } from './plist';
import { logPathFor, thisCli, watchArgsFor } from './program';

export class AutostartError extends Error {
  override name = 'AutostartError';
}

export function requireMac(): void {
  if (process.platform !== 'darwin') {
    throw new AutostartError('Starting by itself works on macOS only so far.');
  }
}

export async function install(global: GlobalValues, args: WatchArgs, io: WatchIo): Promise<void> {
  requireMac();
  const { config, folder, settings } = await setUp(global, args, io, new AbortController().signal);
  // The job doesn't get this shell's variables, so a token from one would be missing at login.
  if (config.tokenSource && config.tokenSource !== 'tracker login') {
    throw new AutostartError(
      `The token comes from ${config.tokenSource}, which the helper won't have when it starts at login. Run "tracker login --url ${config.url}" first.`,
    );
  }
  const environment = {
    PATH: io.env.PATH ?? '',
    ...(io.env.TRACKER_CONFIG ? { TRACKER_CONFIG: io.env.TRACKER_CONFIG } : {}),
  };
  const logPath = logPathFor(settings.projectKey);
  installAgent({
    label: labelFor(folder),
    program: [...thisCli(), ...watchArgsFor(settings.projectKey, config.url, args)],
    folder,
    logPath,
    environment,
  });
  io.stdout(
    [
      `Installed. tracker watch for ${settings.projectKey} now runs in ${folder} by itself: it starts when you log in, and again if it crashes.`,
      `Logs: ${logPath}`,
      'The Mac must stay logged in. After a restart with FileVault on, it waits for your password first.',
      'Stop it with: tracker watch --uninstall',
    ].join('\n'),
  );
}

export function uninstall(io: WatchIo): void {
  requireMac();
  const folder = canonicalPath(io.cwd);
  io.stdout(
    uninstallAgent(labelFor(folder))
      ? `Uninstalled. tracker watch no longer starts by itself in ${folder}.`
      : `tracker watch wasn't installed for ${folder}.`,
  );
}
