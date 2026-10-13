import type { RunEvent } from '@tracker/shared';
import { describeError } from '../errors';
import { createProblemLog, type ProblemSource } from './problems';
import { handBackReport } from './report/handBack';
import { reviewOutcome } from './report/reviewCheck';
import { createLanes } from './lanes';
import type { RunLoopDeps } from './runLoop';
import { createStepBatcher } from './steps/stepBatcher';
import { showStillWorking } from './stillWorking';
import { runUsageOf } from './usage/runUsage';
import { createSessionMarks } from './usage/sessionMarks';

export interface WatcherSettings {
  runnerId: string;
  name: string;
  projectKey: string;
  trackerUrl: string;
}

// A tracker that hangs mustn't hold up the run's end, which waits for the last steps.
const STEP_SEND_TIMEOUT_MS = 10_000;

export type WatcherDeps = Omit<
  RunLoopDeps,
  'describe' | 'onProblem' | 'handBack' | 'checkReview' | 'signOfLife' | 'stepsFor' | 'usageOf'
> & {
  aliveEvery?: number | undefined;
  stepEvery?: number | undefined;
};

export function createWatcher(deps: WatcherDeps, settings: WatcherSettings) {
  const describe = (error: unknown) => describeError(error, { trackerUrl: settings.trackerUrl });
  const noteProblem = createProblemLog(deps.log);
  const onProblem = (source: ProblemSource, error: unknown) =>
    noteProblem(source, error === undefined ? undefined : describe(error));
  // Both lanes: an Edit question resumes its chat's session in the ticket lane.
  const sessions = createSessionMarks();
  const runs = createLanes(
    {
      ...deps,
      describe,
      onProblem,
      handBack: (job, texts) =>
        handBackReport({ api: deps.api, log: deps.log, describe }, job, texts),
      checkReview: (job, outcome) =>
        reviewOutcome({ api: deps.api, log: deps.log, describe }, job, outcome),
      signOfLife: (ticketKey) =>
        showStillWorking(ticketKey, { log: deps.log, every: deps.aliveEvery }),
      stepsFor: (runId) =>
        createStepBatcher({
          send: (steps) =>
            deps.api.addRunSteps(
              runId,
              { runnerId: settings.runnerId, steps },
              { signal: AbortSignal.timeout(STEP_SEND_TIMEOUT_MS) },
            ),
          log: deps.log,
          describe,
          every: deps.stepEvery,
        }),
      usageOf: (job, exit) => runUsageOf(job, exit, sessions),
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
      onProblem('check-in', undefined);
    } catch (error) {
      onProblem('check-in', error);
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
