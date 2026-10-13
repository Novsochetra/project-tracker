import { dirname } from 'node:path';
import type { GlobalValues } from '../../cli/options';
import { loadConfig } from '../../config';
import { canonicalPath } from '../paths';
import { setUp } from '../setup';
import type { WatchArgs, WatchIo } from '../watchIo';
import { jobFor } from './job';
import { labelFor } from './names';
import { requireAutostart } from './platform';
import { refuseTokenFromEnv, requireFreeFolder } from './rules';

export async function install(global: GlobalValues, args: WatchArgs, io: WatchIo): Promise<void> {
  const autostart = requireAutostart();
  refuseTokenFromEnv(loadConfig(io.env, global, io.store.read()));
  const here = canonicalPath(io.cwd);
  requireFreeFolder(dirname(io.store.path), here, () => autostart.runningPid(labelFor(here)));
  const { config, folder, settings } = await setUp(global, args, io, new AbortController().signal);
  const job = jobFor({
    config,
    configPath: io.store.path,
    folder,
    projectKey: settings.projectKey,
    args,
    env: io.env,
  });
  const installed = autostart.install(job);
  io.stdout(
    [
      `Installed. tracker watch for ${settings.projectKey} now runs in ${folder} by itself: ${installed.starts}.`,
      ...installed.notes,
      'Stop it with: tracker watch --uninstall',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

export function uninstall(io: WatchIo): void {
  const autostart = requireAutostart();
  const folder = canonicalPath(io.cwd);
  io.stdout(
    autostart.uninstall(labelFor(folder))
      ? `Uninstalled. tracker watch no longer starts by itself in ${folder}.`
      : `tracker watch wasn't installed for ${folder}.`,
  );
}
