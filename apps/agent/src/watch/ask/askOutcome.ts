import { CHAT_ANSWER_MAX, CHAT_NO_ANSWER, type FinishRunInput } from '@tracker/shared';
import { failureOf, type ClaudeExit } from '../outcome';
import { finalResult } from '../stream/claudeResult';
import { isSessionId } from './askArgs';

const CUT_NOTE = '\n\n… (cut: the answer was too long for the tracker)';

export const fittedAnswer = (answer: string): string =>
  answer.length <= CHAT_ANSWER_MAX
    ? answer
    : `${answer.slice(0, CHAT_ANSWER_MAX - CUT_NOTE.length)}${CUT_NOTE}`;

export function askOutcomeOf(exit: ClaudeExit, cancelled: boolean): FinishRunInput {
  if (cancelled) return { status: 'cancelled' };
  if (exit.turnEnded && exit.results.length === 0)
    return { status: 'failed', error: CHAT_NO_ANSWER };
  const result = finalResult(exit.results);
  const answer = result?.text ?? '';
  if ((exit.code === 0 || exit.turnEnded) && result && !result.isError && answer) {
    const sessionId = isSessionId(result.sessionId) ? result.sessionId : undefined;
    return { status: 'done', answer: fittedAnswer(answer), ...(sessionId ? { sessionId } : {}) };
  }
  return failureOf(exit);
}
