import {
  AUTO_REVIEW_STOPPED,
  chainStopReason,
  RUN_PROMPT_MAX,
  type Run,
  type Runner,
} from '@tracker/shared';
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
  state: 'working' | 'stopped' | 'finished';
  run: Run;
  text: string;
}

export const workingText = (run: Pick<Run, 'runnerName'>): string =>
  `Claude is working on ${run.runnerName}…`;

export const stoppedText = (run: Pick<Run, 'error'>): string =>
  run.error ? `Claude stopped: ${run.error}` : 'Claude stopped.';

export const finishedText = (run: Pick<Run, 'runnerName'>): string =>
  `Claude finished on ${run.runnerName}.`;

// A run that failed says why. One that ended well says so when the automatic review stopped, or
// to say what it took, which helpers from before PT-195 don't send.
function endedRun(run: Run): ShownRun | null {
  if (run.status === 'failed') return { state: 'stopped', run, text: stoppedText(run) };
  if (run.status !== 'done') return null;
  if (run.chainStop) {
    const reason = chainStopReason(run.chainStop, run.runnerName);
    const text = reason ? `${AUTO_REVIEW_STOPPED}. ${reason}` : `${AUTO_REVIEW_STOPPED}.`;
    return { state: 'stopped', run, text };
  }
  return run.usage ? { state: 'finished', run, text: finishedText(run) } : null;
}

const count = new Intl.NumberFormat('en-US');

// Long instructions, a long description or many comments can build one; Copy still takes it.
export const runPromptTooLong = (text: string): string | null =>
  text.length > RUN_PROMPT_MAX
    ? `A run takes a prompt of up to ${count.format(RUN_PROMPT_MAX)} characters. ` +
      `This one has ${count.format(text.length)}: shorten it to run it, or copy it.`
    : null;

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
  if (now - runTime(latest) >= STOPPED_SHOWN_MS) return null;
  return endedRun(latest);
}
