import { RUN_ERROR_MAX, type FinishRunInput, type RunJob } from '@tracker/shared';

export interface ClaudeExit {
  code: number | null;
  output: string;
}

export function refusalOf(job: RunJob, projectKey: string): string | undefined {
  if (job.run.ticketKey.startsWith(`${projectKey}-`)) return undefined;
  return `This helper only runs ${projectKey} tickets, not ${job.run.ticketKey}.`;
}

export function lastLines(text: string, max = RUN_ERROR_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const tail = trimmed.slice(-max);
  const lineStart = tail.indexOf('\n');
  return lineStart === -1 ? tail : tail.slice(lineStart + 1);
}

export function outcomeOf(exit: ClaudeExit, cancelled: boolean): FinishRunInput {
  if (cancelled) return { status: 'cancelled' };
  if (exit.code === 0) return { status: 'done' };
  const reason =
    exit.code === null ? 'Claude Code did not start.' : `Claude Code exited with ${exit.code}.`;
  return { status: 'failed', error: lastLines(`${reason}\n${exit.output}`) };
}
