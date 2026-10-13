import { TrackerClient } from '@tracker/client';
import { formatRelative } from '@tracker/shared';
import type { GlobalValues } from '../../cli/options';
import { loadConfig } from '../../config';
import { describeError } from '../../errors';
import { trackerKey } from '../../savedConfig';
import { canonicalPath } from '../paths';
import type { WatchIo } from '../watchIo';
import { labelFor } from './names';
import { autostartOn, type Autostart } from './platform';

async function trackerLine(
  url: string | undefined,
  global: GlobalValues,
  io: WatchIo,
  folder: string,
) {
  const saved = io.store.read();
  const config = loadConfig(io.env, url ? { ...global, url } : global, saved);
  const runnerId = saved.runners?.[`${trackerKey(config.url)} ${folder}`];
  if (!runnerId) return `At the tracker: this folder has never checked in to ${config.url}.`;
  try {
    const client = new TrackerClient({ baseUrl: config.url, token: config.token });
    const runner = (await client.listRunners()).find(({ id }) => id === runnerId);
    if (!runner) return `At the tracker: not known at ${config.url}.`;
    const seen = runner.online
      ? 'online'
      : `offline, last seen ${formatRelative(runner.lastSeenAt)}`;
    return `At the tracker: "${runner.name}" is ${seen}.`;
  } catch (error) {
    return `At the tracker: ${describeError(error, { trackerUrl: config.url })}`;
  }
}

export async function check(
  global: GlobalValues,
  io: WatchIo,
  autostart: Autostart | undefined = autostartOn(),
): Promise<void> {
  const folder = canonicalPath(io.cwd);
  const label = labelFor(folder);
  const installed = autostart?.isInstalled(label) ? autostart : undefined;
  const url = installed?.installedUrl(label) || global.url;
  io.stdout(
    [
      `Folder: ${folder}`,
      ...(installed ? ['Installed: yes.', ...installed.statusLines(label)] : ['Installed: no.']),
      await trackerLine(url, global, io, folder),
    ].join('\n'),
  );
}
