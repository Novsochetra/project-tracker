import { dirname } from 'node:path';
import type { GlobalValues } from '../../cli/options';
import { loadConfig } from '../../config';
import { FolderBusyError, lockFolder } from '../folderLock';
import { canonicalPath } from '../paths';
import { setUp } from '../setup';
import type { WatchArgs, WatchIo } from '../watchIo';
import { jobFor, thisCli } from './job';
import { pidFrom } from './jobState';
import { installAgent, jobState, uninstallAgent } from './launchd';
import { labelFor } from './names';
import { privacyNote, refuseTokenFromEnv, requireMac } from './rules';

// An installed helper would only keep failing on the lock while another one runs; the installed
// job itself may hold it, since installing again boots it out.
function requireFreeFolder(io: WatchIo, folder: string): void {
  try {
    lockFolder(dirname(io.store.path), folder)();
  } catch (error) {
    if (error instanceof FolderBusyError && error.holder === pidFrom(jobState(labelFor(folder)))) {
      return;
    }
    throw error;
  }
}

export async function install(global: GlobalValues, args: WatchArgs, io: WatchIo): Promise<void> {
  requireMac();
  refuseTokenFromEnv(loadConfig(io.env, global, io.store.read()));
  requireFreeFolder(io, canonicalPath(io.cwd));
  const { config, folder, settings } = await setUp(global, args, io, new AbortController().signal);
  const cli = thisCli();
  const job = jobFor(
    {
      config,
      configPath: io.store.path,
      folder,
      projectKey: settings.projectKey,
      args,
      env: io.env,
    },
    cli,
  );
  installAgent(job);
  io.stdout(
    [
      `Installed. tracker watch for ${settings.projectKey} now runs in ${folder} by itself: it starts when you log in, and again if it crashes.`,
      `Logs: ${job.logPath}`,
      'The Mac must stay logged in. After a restart with FileVault on, it waits for your password first.',
      privacyNote([folder, cli.at(-1) ?? '']),
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
