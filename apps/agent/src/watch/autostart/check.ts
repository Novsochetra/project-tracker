import { TrackerClient } from '@tracker/client';
import { formatRelative } from '@tracker/shared';
import type { GlobalValues } from '../../cli/options';
import { loadConfig } from '../../config';
import { describeError } from '../../errors';
import { trackerKey } from '../../savedConfig';
import { canonicalPath } from '../paths';
import type { WatchIo } from '../watchIo';
import { lastExitFrom, pidFrom } from './jobState';
import { isInstalled, jobState, plistUrl } from './launchd';
import { labelFor, logPathOf } from './names';

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

function jobLines(label: string): string[] {
  if (process.platform !== 'darwin' || !isInstalled(label)) return ['Installed: no.'];
  const state = jobState(label);
  const pid = pidFrom(state);
  if (pid !== undefined) return ['Installed: yes.', `Running by itself: yes (process ${pid}).`];
  return [
    'Installed: yes.',
    `Running by itself: no (last exit code: ${lastExitFrom(state) ?? 'unknown'}).`,
    `Log: ${logPathOf(label)}`,
  ];
}

export async function check(global: GlobalValues, io: WatchIo): Promise<void> {
  const folder = canonicalPath(io.cwd);
  const label = labelFor(folder);
  const url = (process.platform === 'darwin' && plistUrl(label)) || global.url;
  io.stdout(
    [`Folder: ${folder}`, ...jobLines(label), await trackerLine(url, global, io, folder)].join(
      '\n',
    ),
  );
}
