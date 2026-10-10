import type { Run, Runner } from '@tracker/shared';
import { isWorking } from '../../api/workingRun';
import { helpersFor, pickHelper, stoppedText } from '../claude/runs';

export type ChatFooter =
  | { kind: 'loading' }
  | { kind: 'thinking'; run: Run }
  | { kind: 'setup'; stopped: string | null }
  | { kind: 'ask'; helpers: Runner[]; helper: Runner; stopped: string | null };

export interface ChatFooterInput {
  runners: readonly Runner[] | undefined;
  run: Run | null | undefined;
  projectKey: string;
  lastUsedId: string | null;
}

export const thinkingText = (run: Pick<Run, 'runnerName'>): string =>
  `Claude is thinking on ${run.runnerName}…`;

// The latest ask's failure stays until the next question, which is how the person tries again.
const stoppedOf = (run: Run | null | undefined): string | null =>
  run?.status === 'failed' ? stoppedText(run) : null;

export function chatFooter({ runners, run, projectKey, lastUsedId }: ChatFooterInput): ChatFooter {
  if (run && isWorking(run)) return { kind: 'thinking', run };
  if (!runners) return { kind: 'loading' };
  const stopped = stoppedOf(run);
  const helpers = helpersFor(runners, projectKey);
  const helper = pickHelper(helpers, lastUsedId);
  return helper ? { kind: 'ask', helpers, helper, stopped } : { kind: 'setup', stopped };
}

export const helperOf = (footer: ChatFooter): Runner | null =>
  footer.kind === 'ask' ? footer.helper : null;
