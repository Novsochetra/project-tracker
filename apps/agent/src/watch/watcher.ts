import type { FinishRunInput, RunEvent, RunJob } from '@tracker/shared';
import { outcomeOf, refusalOf, type ClaudeExit } from './outcome';
import { reportEnd } from './report';
import type { WatchApi } from './watchApi';

export interface WatcherSettings {
  runnerId: string;
  name: string;
  projectKey: string;
}

export interface WatcherDeps {
  api: WatchApi;
  runClaude: (prompt: string, signal: AbortSignal) => Promise<ClaudeExit>;
  log: (text: string) => void;
  retryDelay?: (attempt: number) => number;
}

const ENDINGS: Record<FinishRunInput['status'], string> = {
  done: 'Claude Code finished',
  failed: 'Claude Code stopped with an error',
  cancelled: 'Cancelled',
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function createWatcher(deps: WatcherDeps, settings: WatcherSettings) {
  const { api, log } = deps;
  let working: { runId: string; stop: AbortController } | undefined;
  let looking: Promise<void> | undefined;
  let stopped = false;
  let problem: string | undefined;

  const noteProblem = (text: string | undefined) => {
    if (text && text !== problem) log(text);
    if (!text && problem) log('In touch with the tracker again.');
    problem = text;
  };

  async function finish(runId: string, ticketKey: string, outcome: FinishRunInput) {
    const failure = await reportEnd(api, runId, outcome, deps.retryDelay);
    log(`${ticketKey}: ${ENDINGS[outcome.status]}.`);
    if (failure) log(`Couldn't tell the tracker how ${ticketKey} ended: ${failure}`);
  }

  async function work(job: RunJob) {
    const { id, ticketKey } = job.run;
    const refusal = refusalOf(job, settings.projectKey);
    if (refusal) return finish(id, ticketKey, { status: 'failed', error: refusal });
    log(`Claude Code is working on ${ticketKey}…`);
    working = { runId: id, stop: new AbortController() };
    const { stop } = working;
    const exit = await deps.runClaude(job.prompt, stop.signal);
    working = undefined;
    await finish(id, ticketKey, outcomeOf(exit, stop.signal.aborted));
  }

  async function takeRuns() {
    try {
      for (let job = await api.takeNextRun(settings.runnerId); job;) {
        await work(job);
        job = stopped ? null : await api.takeNextRun(settings.runnerId);
      }
      noteProblem(undefined);
    } catch (error) {
      noteProblem(`Couldn't reach the tracker: ${messageOf(error)}`);
    }
  }

  function lookForWork(): Promise<void> {
    if (stopped || looking) return looking ?? Promise.resolve();
    looking = takeRuns().finally(() => {
      looking = undefined;
    });
    return looking;
  }

  async function stopIfCancelled() {
    const current = working;
    if (!current) return;
    const run = await api.getRun(current.runId);
    if (run.status === 'cancelled') current.stop.abort();
  }

  async function checkIn() {
    try {
      await api.registerRunner(settings.runnerId, {
        name: settings.name,
        projectKeys: [settings.projectKey],
      });
      await stopIfCancelled();
      noteProblem(undefined);
    } catch (error) {
      noteProblem(`Couldn't reach the tracker: ${messageOf(error)}`);
    }
    void lookForWork();
  }

  function onRunEvent(event: RunEvent) {
    if (event.runnerId !== settings.runnerId) return;
    if (event.status === 'queued') void lookForWork();
    if (event.status === 'cancelled' && working?.runId === event.runId) working.stop.abort();
  }

  async function stop() {
    stopped = true;
    working?.stop.abort();
    await looking;
  }

  return { checkIn, lookForWork, onRunEvent, stop };
}

export type Watcher = ReturnType<typeof createWatcher>;
