import type { FinishRunInput, RunJob, RunKind } from '@tracker/shared';
import { askOutcomeOf } from './ask/askOutcome';
import type { OnSteps } from './claudeRunners';
import type { ClaudeExit } from './outcome';
import { outcomeOf } from './outcome';
import { refusalOf } from './refusal';
import { labelOf } from './runLabel';
import { retryUntilAnswered } from './retry';
import type { StepBatcher } from './steps/stepBatcher';
import type { WatchApi } from './watchApi';

export interface RunLoopDeps {
  api: WatchApi;
  runClaude: (prompt: string, signal: AbortSignal, onSteps: OnSteps) => Promise<ClaudeExit>;
  runAsk: (job: RunJob, signal: AbortSignal, onSteps: OnSteps) => Promise<ClaudeExit>;
  log: (text: string) => void;
  describe: (error: unknown) => string;
  onProblem: (error: unknown) => void;
  handBack: (job: RunJob, texts: readonly string[]) => Promise<void>;
  signOfLife: (ticketKey: string) => () => void;
  stepsFor: (runId: string) => StepBatcher;
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

// Every turn's result: the report can be in an earlier one than the last (background work).
const reportTexts = ({ results, output }: ClaudeExit): string[] =>
  results.length > 0 ? results.map(({ text }) => text) : [output];

type Runner = (
  deps: RunLoopDeps,
  job: RunJob,
  stop: AbortSignal,
  onSteps: OnSteps,
) => Promise<FinishRunInput>;

const runTicket: Runner = async (deps, job, stop, onSteps) => {
  const exit = await deps.runClaude(job.prompt, stop, onSteps);
  const outcome = outcomeOf(exit, stop.aborted);
  // A cancelled run was stopped part way, so whatever it printed is not a report of the work.
  if (outcome.status !== 'cancelled') await deps.handBack(job, reportTexts(exit));
  return outcome;
};

const runAsk: Runner = async (deps, job, stop, onSteps) =>
  askOutcomeOf(await deps.runAsk(job, stop, onSteps), stop.aborted);

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
    const steps = deps.stepsFor(job.run.id);
    const outcome = await (asking ? runAsk : runTicket)(deps, job, stop.signal, steps.add);
    quiet();
    await steps.end();
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
