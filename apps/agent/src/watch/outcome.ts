import { RUN_ERROR_MAX, type FinishRunInput } from '@tracker/shared';

export interface ClaudeExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  // The last of stdout and stderr together, as the person would have seen it.
  output: string;
  stdout: string;
}

export function lastLines(text: string, max = RUN_ERROR_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const tail = trimmed.slice(-max);
  const lineStart = tail.indexOf('\n');
  return lineStart === -1 ? tail : tail.slice(lineStart + 1);
}

export function reasonOf({ code, signal }: Pick<ClaudeExit, 'code' | 'signal'>): string {
  if (code !== null) return `Claude Code exited with ${code}.`;
  return signal ? `Claude Code was stopped (${signal}).` : 'Claude Code did not start.';
}

export function outcomeOf(exit: Omit<ClaudeExit, 'stdout'>, cancelled: boolean): FinishRunInput {
  if (cancelled) return { status: 'cancelled' };
  if (exit.code === 0) return { status: 'done' };
  return { status: 'failed', error: lastLines(`${reasonOf(exit)}\n${exit.output}`) };
}
