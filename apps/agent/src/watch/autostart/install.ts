import { dirname } from 'node:path';
import type { GlobalValues } from '../../cli/options';
import { loadConfig } from '../../config';
import { lockFolder } from '../folderLock';
import { canonicalPath } from '../paths';
import { setUp } from '../setup';
import type { WatchArgs, WatchIo } from '../watchIo';
import { jobFor } from './job';
import { installAgent, uninstallAgent } from './launchd';
import { labelFor } from './names';
import { privacyNote, refuseTokenFromEnv, requireMac } from './rules';

// The installed helper would only keep failing on the lock while this one runs.
const requireFreeFolder = (io: WatchIo, folder: string) =>
  lockFolder(dirname(io.store.path), folder)();

export async function install(global: GlobalValues, args: WatchArgs, io: WatchIo): Promise<void> {
  requireMac();
  refuseTokenFromEnv(loadConfig(io.env, global, io.store.read()));
  requireFreeFolder(io, canonicalPath(io.cwd));
  const { config, folder, settings } = await setUp(global, args, io, new AbortController().signal);
  const job = jobFor({
    config,
    configPath: io.store.path,
    folder,
    projectKey: settings.projectKey,
    args,
    env: io.env,
  });
  installAgent(job);
  io.stdout(
    [
      `Installed. tracker watch for ${settings.projectKey} now runs in ${folder} by itself: it starts when you log in, and again if it crashes.`,
      `Logs: ${job.logPath}`,
      'The Mac must stay logged in. After a restart with FileVault on, it waits for your password first.',
      privacyNote(folder),
      'Stop it with: tracker watch --uninstall',
    ]
      .filter(Boolean)
      .join('\n'),
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
