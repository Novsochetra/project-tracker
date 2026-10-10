import { realpathSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { TrackerClient } from '@tracker/client';
import type { Config, Env } from '../config';
import { loadConfig } from '../config';
import type { ConfigStore } from '../configFile';
import { trackerKey } from '../savedConfig';
import type { GlobalValues } from '../cli/options';
import { claudeIsInstalled, runClaude } from './claude';
import { followRunEvents } from './liveStream';
import { pickProject } from './project';
import { runnerIdFor } from './runnerId';
import { createWatcher, type Watcher, type WatcherSettings } from './watcher';
import type { WatchApi } from './watchApi';

const CHECK_IN_MS = 20_000;
const CLAUDE = 'claude';

export interface WatchArgs {
  project?: string | undefined;
  name?: string | undefined;
  permissionMode?: string | undefined;
}

export interface WatchIo {
  env: Env;
  store: ConfigStore;
  cwd: string;
  stdout: (text: string) => void;
  write: (text: string) => void;
  untilStopped: () => Promise<void>;
}

export class ClaudeMissingError extends Error {
  override name = 'ClaudeMissingError';
}

interface Prepared {
  config: Config;
  api: WatchApi;
  folder: string;
  settings: WatcherSettings;
}

const computerName = (): string => hostname().replace(/\.local$/, '');

async function prepare(global: GlobalValues, args: WatchArgs, io: WatchIo): Promise<Prepared> {
  const config = loadConfig(io.env, global, io.store.read());
  if (!(await claudeIsInstalled(CLAUDE))) {
    throw new ClaudeMissingError('Claude Code (the claude command) is not on PATH here.');
  }
  const api = new TrackerClient({
    baseUrl: config.url,
    token: config.token,
    actor: { kind: 'agent', name: config.agentName },
  });
  const folder = realpathSync(io.cwd);
  const projects = await api.listProjects();
  const projectKey = pickProject(projects, { cwd: folder, home: homedir() }, args.project);
  const runnerId = runnerIdFor([
    trackerKey(config.url),
    hostname(),
    folder,
    projectKey,
    config.token ?? '',
  ]);
  const name = args.name?.trim() || computerName();
  await api.registerRunner(runnerId, { name, projectKeys: [projectKey] });
  return { config, api, folder, settings: { runnerId, name, projectKey } };
}

async function keepWatching({ config }: Prepared, watcher: Watcher, io: WatchIo): Promise<void> {
  const stopping = new AbortController();
  const timer = setInterval(() => void watcher.checkIn(), CHECK_IN_MS);
  const stream = followRunEvents({
    url: config.url,
    token: config.token,
    signal: stopping.signal,
    onOpen: () => void watcher.lookForWork(),
    onRun: watcher.onRunEvent,
    onDrop: () => undefined,
  });
  await io.untilStopped();
  io.stdout('Stopping…');
  clearInterval(timer);
  stopping.abort();
  await Promise.all([watcher.stop(), stream]);
}

export async function watch(global: GlobalValues, args: WatchArgs, io: WatchIo): Promise<void> {
  const prepared = await prepare(global, args, io);
  const { folder, settings, api } = prepared;
  const watcher = createWatcher(
    {
      api,
      log: io.stdout,
      runClaude: (prompt, signal) =>
        runClaude(
          { command: CLAUDE, permissionMode: args.permissionMode, cwd: folder },
          prompt,
          signal,
          io.write,
        ),
    },
    settings,
  );
  io.stdout(
    `Watching ${settings.projectKey} on ${prepared.config.url} as "${settings.name}". ` +
      `Runs started from the app open Claude Code in ${folder}. Leave this open; Ctrl-C stops.`,
  );
  await keepWatching(prepared, watcher, io);
}
