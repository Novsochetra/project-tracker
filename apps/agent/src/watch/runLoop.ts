import type { FinishRunInput, RunJob } from '@tracker/shared';
import type { ClaudeExit } from './outcome';
import { outcomeOf } from './outcome';
import { refusalOf } from './refusal';
import { retryUntilAnswered } from './retry';
import type { WatchApi } from './watchApi';

export interface RunLoopDeps {
  api: WatchApi;
  runClaude: (prompt: string, signal: AbortSignal) => Promise<ClaudeExit>;
  log: (text: string) => void;
  describe: (error: unknown) => string;
  onProblem: (error: unknown) => void;
  retryDelay?: ((attempt: number) => number) | undefined;
}

export interface RunLoopSettings {
  runnerId: string;
  projectKey: string;
}

const ENDINGS: Record<FinishRunInput['status'], string> = {
  done: 'Claude Code finished',
  failed: 'Claude Code stopped with an error',
  cancelled: 'Cancelled',
};

export function createRunLoop(deps: RunLoopDeps, settings: RunLoopSettings) {
  const { api, log } = deps;
  let current: { runId: string; stop: AbortController } | undefined;
  let looking: Promise<void> | undefined;
  let stopped = false;

  async function report({ run }: RunJob, outcome: FinishRunInput) {
    try {
      await retryUntilAnswered(() => api.finishRun(run.id, outcome), {
        delay: deps.retryDelay,
        onWait: () =>
          log(`Couldn't tell the tracker how ${run.ticketKey} ended yet. Trying again.`),
      });
    } catch (error) {
      log(`The tracker didn't take how ${run.ticketKey} ended: ${deps.describe(error)}`);
    }
  }

  async function end(job: RunJob, outcome: FinishRunInput) {
    log(`${job.run.ticketKey}: ${ENDINGS[outcome.status]}.`);
    await report(job, outcome);
  }

  async function work(job: RunJob) {
    const refusal = refusalOf(job, settings.projectKey);
    if (refusal) {
      log(`Refused ${job.run.ticketKey}: ${refusal}`);
      return report(job, { status: 'failed', error: refusal });
    }
    if (stopped) return end(job, { status: 'cancelled' });
    log(`Claude Code is working on ${job.run.ticketKey}…`);
    const stop = new AbortController();
    current = { runId: job.run.id, stop };
    const exit = await deps.runClaude(job.prompt, stop.signal);
    current = undefined;
    await end(job, outcomeOf(exit, stop.signal.aborted));
  }

  async function takeRuns() {
    try {
      while (!stopped) {
        const job = await api.takeNextRun(settings.runnerId);
        if (!job) break;
        await work(job);
      }
      deps.onProblem(undefined);
    } catch (error) {
      deps.onProblem(error);
    }
  }

  function lookForWork(): Promise<void> {
    looking ??= takeRuns().finally(() => {
      looking = undefined;
    });
    return looking;
  }

  function cancel(runId: string) {
    if (current?.runId === runId) current.stop.abort();
  }

  async function stop() {
    stopped = true;
    current?.stop.abort();
    await looking;
  }

  return { lookForWork, cancel, stop, currentRunId: () => current?.runId };
}
