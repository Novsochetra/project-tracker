import type { FinishRunInput, RunJob, RunLane, RunUsageInput } from '@tracker/shared';
import { askOutcomeOf } from './ask/askOutcome';
import type { OnSteps } from './claudeRunners';
import type { ProblemSource } from './problems';
import type { ClaudeExit } from './outcome';
import { lastLines, ticketOutcomeOf } from './outcome';
import { refusalOf } from './refusal';
import { runName } from './runName';
import { retryUntilAnswered } from './retry';
import type { SendChanges } from './changes/runChanges';
import type { StepBatcher } from './steps/stepBatcher';
import type { WatchApi } from './watchApi';

export interface RunLoopDeps {
  api: WatchApi;
  runClaude: (job: RunJob, signal: AbortSignal, onSteps: OnSteps) => Promise<ClaudeExit>;
  runAsk: (job: RunJob, signal: AbortSignal, onSteps: OnSteps) => Promise<ClaudeExit>;
  log: (text: string) => void;
  describe: (error: unknown) => string;
  onProblem: (source: ProblemSource, error: unknown) => void;
  handBack: (job: RunJob, texts: readonly string[]) => Promise<void>;
  checkReview: (job: RunJob, outcome: FinishRunInput) => Promise<FinishRunInput>;
  signOfLife: (ticketKey: string) => () => void;
  stepsFor: (runId: string) => StepBatcher;
  usageOf: (job: RunJob, exit: ClaudeExit) => RunUsageInput | undefined;
  // Sends what the run changed in its folder once Claude exits; none in tests that don't ask.
  trackChanges?: ((job: RunJob) => Promise<SendChanges>) | undefined;
  retryDelay?: ((attempt: number) => number) | undefined;
}

export interface RunLoopSettings {
  runnerId: string;
  projectKey: string;
  kind: RunLane;
}

const ENDINGS: Record<FinishRunInput['status'], string> = {
  done: 'Claude Code finished',
  failed: 'Claude Code stopped with an error',
  cancelled: 'Cancelled',
};

const AGAIN: Record<RunJob['run']['kind'], string> = {
  ask: '',
  ticket: '\nThe run ended. Press Send to Claude to start it again.',
  batch: '\nThe run ended. Press Run all Todo to start it again.',
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

const withUsage = (outcome: FinishRunInput, usage: RunUsageInput | undefined): FinishRunInput =>
  usage ? { ...outcome, usage } : outcome;

async function ticketEnding(
  deps: RunLoopDeps,
  job: RunJob,
  exit: ClaudeExit,
  outcome: FinishRunInput,
): Promise<FinishRunInput> {
  // A cancelled run was stopped part way, so whatever it printed is not a report of the work.
  if (outcome.status === 'cancelled') return outcome;
  // A reviewer's words are a review, not a report of the work; review_ticket records it.
  if (job.run.role === 'review') return deps.checkReview(job, outcome);
  await deps.handBack(job, reportTexts(exit));
  return outcome;
}

const runTicket: Runner = async (deps, job, stop, onSteps) => {
  const exit = await deps.runClaude(job, stop, onSteps);
  const outcome = await ticketEnding(deps, job, exit, ticketOutcomeOf(exit, stop.aborted));
  return withUsage(outcome, deps.usageOf(job, exit));
};

const runAsk: Runner = async (deps, job, stop, onSteps) => {
  const exit = await deps.runAsk(job, stop, onSteps);
  return withUsage(askOutcomeOf(exit, stop.aborted), deps.usageOf(job, exit));
};

// Claude never ran, as when the prompt tool's socket can't open, so the run ends with why rather
// than leave it running on the tracker and this lane stuck on it. The window says why too, since
// no output of Claude's shows it there.
const runSafely: Runner = async (deps, job, stop, onSteps) => {
  try {
    return await (job.run.kind === 'ask' ? runAsk : runTicket)(deps, job, stop, onSteps);
  } catch (error) {
    if (stop.aborted) return { status: 'cancelled' };
    const why = `Claude Code could not start: ${deps.describe(error)}`;
    deps.log(`${runName(job.run)}: ${why}`);
    // The ticket shows this, and nothing starts the run again until the person starts it again.
    const next = AGAIN[job.run.kind];
    return { status: 'failed', error: lastLines(why + next) };
  }
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
    const label = runName(run);
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
    log(`${runName(job.run)}: ${ENDINGS[outcome.status]}.`);
    await report(job, outcome);
  }

  async function work(job: RunJob) {
    const label = runName(job.run);
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
    const sendChanges = await deps.trackChanges?.(job);
    const outcome = await runSafely(deps, job, stop.signal, steps.add);
    quiet();
    await steps.end();
    await sendChanges?.(outcome);
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
      deps.onProblem(settings.kind, undefined);
    } catch (error) {
      deps.onProblem(settings.kind, error);
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
