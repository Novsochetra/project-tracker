import type { FinishRunInput, RunJob, RunKind } from '@tracker/shared';
import { askOutcomeOf } from './ask/askOutcome';
import type { ClaudeExit } from './outcome';
import { outcomeOf } from './outcome';
import { refusalOf } from './refusal';
import { labelOf } from './runLabel';
import { retryUntilAnswered } from './retry';
import type { WatchApi } from './watchApi';

export interface RunLoopDeps {
  api: WatchApi;
  runClaude: (prompt: string, signal: AbortSignal) => Promise<ClaudeExit>;
  runAsk: (job: RunJob, signal: AbortSignal) => Promise<ClaudeExit>;
  log: (text: string) => void;
  describe: (error: unknown) => string;
  onProblem: (error: unknown) => void;
  handBack: (job: RunJob, output: string) => Promise<void>;
  signOfLife: (ticketKey: string) => () => void;
  retryDelay?: ((attempt: number) => number) | undefined;
}

export interface RunLoopSettings {
  runnerId: string;
  projectKey: string;
  kind: RunKind;
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
  let unreported: string | undefined;

  const stillReporting = () =>
    log(`Still telling the tracker how ${unreported} ended. Press Ctrl-C again to quit now.`);

  async function report({ run }: RunJob, outcome: FinishRunInput) {
    const label = labelOf(run);
    const onWait = () => {
      unreported = label;
      if (stopped) stillReporting();
      else log(`Couldn't tell the tracker how ${label} ended yet. Trying again.`);
    };
    try {
      await retryUntilAnswered(() => api.finishRun(run.id, outcome), {
        delay: deps.retryDelay,
        onWait,
      });
    } catch (error) {
      log(`The tracker didn't take how ${label} ended: ${deps.describe(error)}`);
    } finally {
      unreported = undefined;
    }
  }

  async function end(job: RunJob, outcome: FinishRunInput) {
    log(`${labelOf(job.run)}: ${ENDINGS[outcome.status]}.`);
    await report(job, outcome);
  }

  async function runTicket(job: RunJob, stop: AbortSignal): Promise<FinishRunInput> {
    const exit = await deps.runClaude(job.prompt, stop);
    const outcome = outcomeOf(exit, stop.aborted);
    // A cancelled run was stopped part way, so whatever it printed is not a report of the work.
    if (outcome.status !== 'cancelled') await deps.handBack(job, exit.output);
    return outcome;
  }

  async function runAsk(job: RunJob, stop: AbortSignal): Promise<FinishRunInput> {
    return askOutcomeOf(await deps.runAsk(job, stop), stop.aborted);
  }

  async function work(job: RunJob) {
    const label = labelOf(job.run);
    const refusal = refusalOf(job, settings);
    if (refusal) {
      log(`Refused ${label}: ${refusal}`);
      return report(job, { status: 'failed', error: refusal });
    }
    if (stopped) return end(job, { status: 'cancelled' });
    // An Edit question runs in the ticket lane but is still a question: its answer goes to the chat.
    const asking = job.run.kind === 'ask';
    log(
      asking
        ? `Claude Code is answering a question in ${label}…`
        : `Claude Code is working on ${label}…`,
    );
    const stop = new AbortController();
    current = { runId: job.run.id, stop };
    const quiet = deps.signOfLife(label);
    const outcome = await (asking ? runAsk : runTicket)(job, stop.signal);
    quiet();
    current = undefined;
    await end(job, outcome);
  }

  async function takeRuns() {
    try {
      while (!stopped) {
        const job = await api.takeNextRun(settings.runnerId, settings.kind);
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
    if (unreported) stillReporting();
    await looking;
  }

  return { lookForWork, cancel, stop, currentRunId: () => current?.runId };
}
