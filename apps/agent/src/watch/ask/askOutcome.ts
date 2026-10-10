import { CHAT_ANSWER_MAX, type FinishRunInput } from '@tracker/shared';
import { lastLines, reasonOf, type ClaudeExit } from '../outcome';
import { isSessionId } from './askArgs';

interface ClaudeResult {
  result?: unknown;
  session_id?: unknown;
  is_error?: unknown;
}

const CUT_NOTE = '\n\n… (cut: the answer was too long for the tracker)';

function parseResult(stdout: string): ClaudeResult | null {
  const lines = stdout.trim().split('\n').reverse();
  for (const line of [stdout.trim(), ...lines]) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (value && typeof value === 'object') return value;
    } catch {
      continue;
    }
  }
  return null;
}

const fitted = (answer: string) =>
  answer.length <= CHAT_ANSWER_MAX
    ? answer
    : `${answer.slice(0, CHAT_ANSWER_MAX - CUT_NOTE.length)}${CUT_NOTE}`;

// claude -p --output-format json prints one object: the answer, its session and whether it failed.
export function askOutcomeOf(exit: ClaudeExit, cancelled: boolean): FinishRunInput {
  if (cancelled) return { status: 'cancelled' };
  const parsed = parseResult(exit.stdout);
  const answer = typeof parsed?.result === 'string' ? parsed.result.trim() : '';
  if (exit.code === 0 && parsed?.is_error !== true && answer) {
    const sessionId = isSessionId(parsed?.session_id) ? parsed.session_id : undefined;
    return { status: 'done', answer: fitted(answer), ...(sessionId ? { sessionId } : {}) };
  }
  const said = parsed?.is_error === true && answer ? answer : exit.output;
  return { status: 'failed', error: lastLines(`${reasonOf(exit)}\n${said}`) };
}
