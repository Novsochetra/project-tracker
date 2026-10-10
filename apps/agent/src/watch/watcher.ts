import type { RunEvent } from '@tracker/shared';
import { describeError } from '../errors';
import { createProblemLog } from './problems';
import { handBackReport } from './report/handBack';
import { createLanes } from './lanes';
import type { RunLoopDeps } from './runLoop';
import { showStillWorking } from './stillWorking';

export interface WatcherSettings {
  runnerId: string;
  name: string;
  projectKey: string;
  trackerUrl: string;
}

export type WatcherDeps = Omit<
  RunLoopDeps,
  'describe' | 'onProblem' | 'handBack' | 'signOfLife'
> & {
  aliveEvery?: number | undefined;
};

export function createWatcher(deps: WatcherDeps, settings: WatcherSettings) {
  const describe = (error: unknown) => describeError(error, { trackerUrl: settings.trackerUrl });
  const noteProblem = createProblemLog(deps.log);
  const onProblem = (error: unknown) =>
    noteProblem(error === undefined ? undefined : describe(error));
  const runs = createLanes(
    {
      ...deps,
      describe,
      onProblem,
      handBack: (job, output) =>
        handBackReport({ api: deps.api, log: deps.log, describe }, job, output),
      signOfLife: (ticketKey) =>
        showStillWorking(ticketKey, { log: deps.log, every: deps.aliveEvery }),
    },
    settings,
  );

  async function stopIfCancelled() {
    for (const runId of runs.currentRunIds()) {
      if ((await deps.api.getRun(runId)).status === 'cancelled') runs.cancel(runId);
    }
  }

  async function checkIn() {
    try {
      await deps.api.registerRunner(settings.runnerId, {
        name: settings.name,
        projectKeys: [settings.projectKey],
      });
      await stopIfCancelled();
      onProblem(undefined);
    } catch (error) {
      onProblem(error);
    }
    void runs.lookForWork();
  }

  function onRunEvent(event: RunEvent) {
    if (event.runnerId !== settings.runnerId) return;
    if (event.status === 'queued') void runs.lookForWork();
    if (event.status === 'cancelled') runs.cancel(event.runId);
  }

  return { checkIn, onRunEvent, lookForWork: runs.lookForWork, stop: runs.stop };
}

export type Watcher = ReturnType<typeof createWatcher>;
