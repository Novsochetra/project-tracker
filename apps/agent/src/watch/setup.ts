import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { TrackerClient } from '@tracker/client';
import type { GlobalValues } from '../cli/options';
import { loadConfig, type Config } from '../config';
import { describeError } from '../errors';
import { claudeIsInstalled } from './claude';
import { computerName, runnerIdFor } from './identity';
import { pickProject } from './project';
import { retryUntilAnswered } from './retry';
import type { WatchArgs, WatchIo } from './watchIo';
import type { WatcherSettings } from './watcher';
import type { WatchApi } from './watchApi';

export const CLAUDE = 'claude';

export class ClaudeMissingError extends Error {
  override name = 'ClaudeMissingError';
}

export interface Setup {
  config: Config;
  api: WatchApi;
  folder: string;
  settings: WatcherSettings;
}

export function canonicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return resolve(path);
  }
}

const clientFor = (config: Config): WatchApi =>
  new TrackerClient({
    baseUrl: config.url,
    token: config.token,
    actor: { kind: 'agent', name: config.agentName },
  });

export async function setUp(
  global: GlobalValues,
  args: WatchArgs,
  io: WatchIo,
  signal: AbortSignal,
): Promise<Setup> {
  const config = loadConfig(io.env, global, io.store.read());
  if (!(await claudeIsInstalled(CLAUDE))) {
    throw new ClaudeMissingError('Claude Code (the claude command) is not on PATH here.');
  }
  const api = clientFor(config);
  const untilAnswered = <T>(task: () => Promise<T>) =>
    retryUntilAnswered(task, {
      signal,
      onWait: (error) =>
        io.stdout(`Waiting for the tracker: ${describeError(error, { trackerUrl: config.url })}`),
    });
  const folder = canonicalPath(io.cwd);
  const projects = await untilAnswered(() => api.listProjects());
  const where = { cwd: folder, home: homedir(), canonical: canonicalPath };
  const settings: WatcherSettings = {
    runnerId: runnerIdFor(io.store, config.url, folder),
    name: args.name?.trim() || computerName(),
    projectKey: pickProject(projects, where, args.project),
    trackerUrl: config.url,
  };
  const { runnerId, name, projectKey } = settings;
  await untilAnswered(() => api.registerRunner(runnerId, { name, projectKeys: [projectKey] }));
  return { config, api, folder, settings };
}
