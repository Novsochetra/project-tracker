import type { Run, Runner } from '@tracker/shared';
import { isWorking } from '../../api/hooks/runs';

// Long enough to see on the next look at the ticket, short enough not to linger once forgotten.
export const STOPPED_SHOWN_MS = 24 * 60 * 60 * 1000;

export type RunFooter = 'copy' | 'setup' | 'run' | 'working';

export interface RunFooterInput {
  helpersKnown: boolean;
  helperCount: number;
  working: boolean;
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

export function workingRun(runs: readonly Run[] | undefined): Run | undefined {
  const latest = runs?.[0];
  return latest && isWorking(latest) ? latest : undefined;
}

export function runFooter({ helpersKnown, helperCount, working }: RunFooterInput): RunFooter {
  if (working) return 'working';
  if (helperCount > 0) return 'run';
  return helpersKnown ? 'setup' : 'copy';
}

export const offersRunSlot = (footer: RunFooter | undefined): boolean =>
  footer === 'run' || footer === 'working';

export const runTime = (run: Run): number => run.endedAt ?? run.startedAt ?? run.createdAt;

export function shownRun(runs: readonly Run[] | undefined, now: number): ShownRun | null {
  const latest = runs?.[0];
  if (!latest) return null;
  if (isWorking(latest)) return { state: 'working', run: latest, text: workingText(latest) };
  if (latest.status !== 'failed' || now - runTime(latest) >= STOPPED_SHOWN_MS) return null;
  return { state: 'stopped', run: latest, text: stoppedText(latest) };
}
