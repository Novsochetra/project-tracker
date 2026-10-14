import { CHAT_NO_ANSWER, type EndedRunStatus, type FinishRunInput } from '@tracker/shared';
import type { RunRow } from '../db/runTables';

export interface Answer {
  text: string;
  sessionId: string | null;
  attachmentIds: string[];
}

export interface RunEnding {
  status: EndedRunStatus;
  error: string | null;
  answer: Answer | null;
}

// An ask that ends without an answer failed, whatever the helper says, so the chat shows why.
export function endingOf(run: Pick<RunRow, 'kind'>, input: FinishRunInput): RunEnding {
  const error = input.error?.trim() || null;
  if (input.status !== 'done') return { status: input.status, error, answer: null };
  if (run.kind !== 'ask') return { status: 'done', error: null, answer: null };
  const text = input.answer?.trim();
  if (!text) return { status: 'failed', error: CHAT_NO_ANSWER, answer: null };
  const answer = {
    text,
    sessionId: input.sessionId ?? null,
    attachmentIds: input.attachmentIds ?? [],
  };
  return { status: 'done', error: null, answer };
}
