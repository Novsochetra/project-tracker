import { homedir } from 'node:os';
import { TrackerClient } from '@tracker/client';
import type { GlobalValues } from '../cli/options';
import { loadConfig, type Config } from '../config';
import { describeError } from '../errors';
import { CLAUDE, claudeIsInstalled } from './claude';
import { requireTrackerTools } from './mcp/checkTools';
import { mcpListOutput } from './mcp/mcpStatus';
import { canonicalPath } from './paths';
import { computerName, runnerIdFor } from './identity';
import { pickProject } from './project';
import { retryUntilAnswered } from './retry';
import { readTools } from './tools/readTools';
import { createToolsCache, type ToolsCache } from './tools/toolsCache';
import type { WatchArgs, WatchIo } from './watchIo';
import type { WatcherSettings } from './watcher';
import type { WatchApi } from './watchApi';

export class ClaudeMissingError extends Error {
  override name = 'ClaudeMissingError';
}

export interface Setup {
  config: Config;
  api: WatchApi;
  folder: string;
  settings: WatcherSettings;
  tools: ToolsCache;
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
  const folder = canonicalPath(io.cwd);
  const listOutput = () => mcpListOutput(CLAUDE, folder);
  const firstList = listOutput();
  await requireTrackerTools({ listOutput: () => firstList, log: io.stdout });
  const tools = createToolsCache({
    first: await readTools(await firstList, folder),
    read: async () => readTools(await listOutput(), folder),
  });
  const api = clientFor(config);
  const untilAnswered = <T>(task: () => Promise<T>) =>
    retryUntilAnswered(task, {
      signal,
      onWait: (error) =>
        io.stdout(`Waiting for the tracker: ${describeError(error, { trackerUrl: config.url })}`),
    });
  const projects = await untilAnswered(() => api.listProjects());
  const where = { cwd: folder, home: homedir(), canonical: canonicalPath };
  const settings: WatcherSettings = {
    runnerId: runnerIdFor(io.store, config.url, folder),
    name: args.name?.trim() || computerName(),
    projectKey: pickProject(projects, where, args.project),
    trackerUrl: config.url,
  };
  const { runnerId, name, projectKey } = settings;
  await untilAnswered(() =>
    api.registerRunner(runnerId, { name, projectKeys: [projectKey], tools: tools.current() }),
  );
  return { config, api, folder, settings, tools };
}
