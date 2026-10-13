import { AUTO_REVIEW_ROUNDS, type ChainStop, type Run, type Runner } from '@tracker/shared';
import { isWorking, workingRun } from '../../api/workingRun';

// Long enough to see on the next look at the ticket, short enough not to linger once forgotten.
export const STOPPED_SHOWN_MS = 24 * 60 * 60 * 1000;

export type RunFooter =
  | { kind: 'copy' }
  | { kind: 'setup' }
  | { kind: 'run'; helpers: Runner[]; helper: Runner }
  | { kind: 'working'; run: Run };

export interface RunFooterInput {
  runners: readonly Runner[] | undefined;
  runs: readonly Run[] | undefined;
  projectKey: string | undefined;
  lastUsedId: string | null;
}

export interface ShownRun {
  state: 'working' | 'stopped';
  run: Run;
  text: string;
}

export const workingText = (run: Pick<Run, 'runnerName'>): string =>
  `Claude is working on ${run.runnerName}…`;

export const stoppedText = (run: Pick<Run, 'error'>): string =>
  run.error ? `Claude stopped: ${run.error}` : 'Claude stopped.';

const CHAIN_STOP_TEXT: Record<ChainStop, (run: Pick<Run, 'runnerName'>) => string> = {
  rounds: () =>
    `Automatic review stopped after ${AUTO_REVIEW_ROUNDS} rounds. The review still asks for changes.`,
  moved: () => 'Automatic review stopped: you moved the ticket.',
  offline: (run) => `Automatic review stopped: ${run.runnerName} can't take the next run.`,
};

// A run that failed says why; one that ended well says so only when the automatic review stopped.
function endedText(run: Run): string | null {
  if (run.status === 'failed') return stoppedText(run);
  if (run.status === 'done' && run.chainStop) return CHAIN_STOP_TEXT[run.chainStop](run);
  return null;
}

export const sentText = (helper: Pick<Runner, 'name'>): string =>
  `Sent to Claude on ${helper.name}`;

const serves = (runner: Runner, projectKey: string): boolean =>
  runner.projectKeys.some((key) => key.toUpperCase() === projectKey.toUpperCase());

export const helpersFor = (runners: readonly Runner[], projectKey: string): Runner[] =>
  runners.filter((runner) => runner.online && serves(runner, projectKey));

export const pickHelper = (
  helpers: readonly Runner[],
  lastUsedId: string | null,
): Runner | undefined => helpers.find(({ id }) => id === lastUsedId) ?? helpers[0];

// Until the helpers are known the footer stays as it always was, Copy alone.
export function runFooter({ runners, runs, projectKey, lastUsedId }: RunFooterInput): RunFooter {
  const working = workingRun(runs);
  if (working) return { kind: 'working', run: working };
  if (!runners || !projectKey) return { kind: 'copy' };
  const helpers = helpersFor(runners, projectKey);
  const helper = pickHelper(helpers, lastUsedId);
  return helper ? { kind: 'run', helpers, helper } : { kind: 'setup' };
}

export const runTime = (run: Run): number => run.endedAt ?? run.startedAt ?? run.createdAt;

export function shownRun(runs: readonly Run[] | undefined, now: number): ShownRun | null {
  const latest = runs?.[0];
  if (!latest) return null;
  if (isWorking(latest)) return { state: 'working', run: latest, text: workingText(latest) };
  const text = endedText(latest);
  if (!text || now - runTime(latest) >= STOPPED_SHOWN_MS) return null;
  return { state: 'stopped', run: latest, text };
}
