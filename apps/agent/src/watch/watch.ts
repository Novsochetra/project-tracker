import { dirname } from 'node:path';
import type { GlobalValues } from '../cli/options';
import { CLAUDE } from './claude';
import { claudeRunners } from './claudeRunners';
import { lockFolder } from './folderLock';
import { keepMacAwake } from './keepAwake';
import { followRunEvents } from './liveStream';
import { canonicalPath } from './paths';
import { setUp, type Setup } from './setup';
import { createWatcher } from './watcher';
import type { WatchArgs, WatchIo } from './watchIo';

const CHECK_IN_MS = 20_000;

const aborted = (signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) resolve();
    signal.addEventListener('abort', () => resolve(), { once: true });
  });

async function keepWatching(setup: Setup, args: WatchArgs, io: WatchIo, signal: AbortSignal) {
  const { api, config, folder, settings } = setup;
  const claude = claudeRunners({
    command: CLAUDE,
    cwd: folder,
    permissionMode: args.permissionMode,
    write: io.write,
  });
  const watcher = createWatcher({ api, log: io.stdout, ...claude }, settings);
  io.stdout(
    `Watching ${settings.projectKey} on ${config.url} as "${settings.name}". ` +
      `Runs started from the app open Claude Code in ${folder}. Leave this open; Ctrl-C stops.`,
  );
  const timer = setInterval(() => void watcher.checkIn(), CHECK_IN_MS);
  const stream = followRunEvents({
    url: api.eventsUrl(),
    token: config.token,
    signal,
    onOpen: () => void watcher.lookForWork(),
    onRun: watcher.onRunEvent,
  });
  await aborted(signal);
  clearInterval(timer);
  io.stdout('Stopping…');
  await Promise.all([watcher.stop(), stream]);
}

export async function watch(global: GlobalValues, args: WatchArgs, io: WatchIo): Promise<void> {
  const stopping = new AbortController();
  void io.untilStopped().then(() => stopping.abort());
  const release = lockFolder(dirname(io.store.path), canonicalPath(io.cwd));
  if (args.keepAwake !== false) keepMacAwake();
  try {
    await keepWatching(await setUp(global, args, io, stopping.signal), args, io, stopping.signal);
  } catch (error) {
    if (!stopping.signal.aborted) throw error;
  } finally {
    release();
  }
}
