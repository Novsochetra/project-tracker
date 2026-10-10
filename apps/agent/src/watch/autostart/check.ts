import { existsSync } from 'node:fs';
import { TrackerClient } from '@tracker/client';
import { formatRelative } from '@tracker/shared';
import type { GlobalValues } from '../../cli/options';
import { loadConfig } from '../../config';
import { describeError } from '../../errors';
import { trackerKey } from '../../savedConfig';
import { canonicalPath } from '../paths';
import type { WatchIo } from '../watchIo';
import { plistPathOf, runningPid } from './launchd';
import { labelFor } from './plist';

async function trackerLine(global: GlobalValues, io: WatchIo, folder: string): Promise<string> {
  const saved = io.store.read();
  const config = loadConfig(io.env, global, saved);
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

export async function check(global: GlobalValues, io: WatchIo): Promise<void> {
  const folder = canonicalPath(io.cwd);
  const label = labelFor(folder);
  const installed = process.platform === 'darwin' && existsSync(plistPathOf(label));
  const pid = installed ? runningPid(label) : undefined;
  io.stdout(
    [
      `Folder: ${folder}`,
      installed ? 'Installed: yes, it starts when you log in.' : 'Installed: no.',
      pid === undefined ? 'Running by itself: no.' : `Running by itself: yes (process ${pid}).`,
      await trackerLine(global, io, folder),
    ].join('\n'),
  );
}
