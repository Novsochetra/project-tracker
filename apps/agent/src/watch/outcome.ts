import { RUN_ERROR_MAX, type FinishRunInput } from '@tracker/shared';
import { finalResult, type ClaudeResult } from './stream/claudeResult';

export interface ClaudeExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  // The last of what the helper's window showed: stderr, stray lines and the result's text.
  output: string;
  // One a turn: background work Claude started (a sub agent) gets a turn of its own when it ends.
  results: ClaudeResult[];
  // The tokens this run's own calls read, to tell a resumed session's earlier figures apart.
  readTokens?: number;
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

// Claude's own words when its last turn failed, such as a turn limit it reached; else the end of
// what the window showed, which has stderr when Claude Code could not get as far as a result.
export function failureOf(exit: ClaudeExit): FinishRunInput {
  const result = finalResult(exit.results);
  const said = result?.isError && result.text ? result.text : exit.output;
  return { status: 'failed', error: lastLines(`${reasonOf(exit)}\n${said}`) };
}

export function ticketOutcomeOf(exit: ClaudeExit, cancelled: boolean): FinishRunInput {
  if (cancelled) return { status: 'cancelled' };
  if (exit.code === 0 && !finalResult(exit.results)?.isError) return { status: 'done' };
  return failureOf(exit);
}
