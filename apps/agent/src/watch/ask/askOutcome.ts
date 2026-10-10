import { CHAT_ANSWER_MAX, type FinishRunInput } from '@tracker/shared';
import { lastLines, reasonOf, type ClaudeExit } from '../outcome';
import { isSessionId } from './askArgs';

const CUT_NOTE = '\n\n… (cut: the answer was too long for the tracker)';

const fitted = (answer: string) =>
  answer.length <= CHAT_ANSWER_MAX
    ? answer
    : `${answer.slice(0, CHAT_ANSWER_MAX - CUT_NOTE.length)}${CUT_NOTE}`;

export function askOutcomeOf(exit: ClaudeExit, cancelled: boolean): FinishRunInput {
  if (cancelled) return { status: 'cancelled' };
  // The last turn's result is how the run ended, as `--output-format json` prints only it: an
  // earlier one is Claude saying it started background work, or a failure it went on from.
  const result = exit.results.at(-1);
  const answer = result?.text ?? '';
  if (exit.code === 0 && result && !result.isError && answer) {
    const sessionId = isSessionId(result.sessionId) ? result.sessionId : undefined;
    return { status: 'done', answer: fitted(answer), ...(sessionId ? { sessionId } : {}) };
  }
  const said = result?.isError && answer ? answer : exit.output;
  return { status: 'failed', error: lastLines(`${reasonOf(exit)}\n${said}`) };
}
