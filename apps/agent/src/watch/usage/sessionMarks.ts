import type { ResultUsage } from '../stream/claudeResult';

export interface SessionMark {
  costUsd: number;
  readTokens: number;
}

// One a chat, and a helper can run for weeks.
const KEPT = 500;

// Where each session's figures stood when its last run here ended, so the next run that resumes
// it can take them off (ownCostUsd).
export function createSessionMarks() {
  const marks = new Map<string, SessionMark>();
  return {
    get: (sessionId: string): SessionMark | undefined => marks.get(sessionId),
    note(sessionId: string | undefined, { costUsd, readTokens }: ResultUsage) {
      if (!sessionId || costUsd === undefined || readTokens === undefined) return;
      marks.delete(sessionId);
      marks.set(sessionId, { costUsd, readTokens });
      const oldest = marks.keys().next();
      if (marks.size > KEPT && !oldest.done) marks.delete(oldest.value);
    },
  };
}

export type SessionMarks = ReturnType<typeof createSessionMarks>;
