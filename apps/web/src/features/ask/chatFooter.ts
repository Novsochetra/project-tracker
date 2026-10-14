import { changesFolder, type Run, type Runner } from '@tracker/shared';
import { isWorking } from '../../api/workingRun';
import { helpersFor, pickHelper, stoppedText } from '../claude/runs';
import { STOPPED_PART_WAY_TEXT, STOPPED_TEXT } from './copy';

export interface StoppedNote {
  kind: 'failed' | 'cancelled';
  text: string;
}

export type ChatFooter =
  | { kind: 'loading' }
  // The helper answering takes a message sent meanwhile, which waits for its own turn (PT-234).
  | { kind: 'thinking'; run: Run; helper: Runner | null }
  | { kind: 'setup'; stopped: StoppedNote | null }
  | { kind: 'ask'; helpers: Runner[]; helper: Runner; stopped: StoppedNote | null };

export interface ChatFooterInput {
  runners: readonly Runner[] | undefined;
  run: Run | null | undefined;
  projectKey: string;
  lastUsedId: string | null;
}

export const thinkingText = (run: Pick<Run, 'runnerName'>): string =>
  `Claude is thinking on ${run.runnerName}…`;

// Only an Edit question that Claude had started may have changed something before it stopped.
export const cancelledText = (run: Pick<Run, 'askOptions' | 'startedAt'>): string =>
  changesFolder(run.askOptions?.mode) && run.startedAt !== null
    ? STOPPED_PART_WAY_TEXT
    : STOPPED_TEXT;

// The latest ask's end stays until the next question, which is how the person tries again.
function stoppedOf(run: Run | null | undefined): StoppedNote | null {
  if (run?.status === 'failed') return { kind: 'failed', text: stoppedText(run) };
  if (run?.status === 'cancelled') return { kind: 'cancelled', text: cancelledText(run) };
  return null;
}

// A card's Run takes a helper's ticket lane, free while its ask lane answers a question.
export function runHelper({
  runners,
  projectKey,
  lastUsedId,
}: Omit<ChatFooterInput, 'run'>): Runner | null {
  return runners ? (pickHelper(helpersFor(runners, projectKey), lastUsedId) ?? null) : null;
}

export function chatFooter({ runners, run, projectKey, lastUsedId }: ChatFooterInput): ChatFooter {
  if (run && isWorking(run)) {
    return {
      kind: 'thinking',
      run,
      helper: runners?.find(({ id }) => id === run.runnerId) ?? null,
    };
  }
  if (!runners) return { kind: 'loading' };
  const stopped = stoppedOf(run);
  const helpers = helpersFor(runners, projectKey);
  const helper = pickHelper(helpers, lastUsedId);
  return helper ? { kind: 'ask', helpers, helper, stopped } : { kind: 'setup', stopped };
}

export const helperOf = (footer: ChatFooter): Runner | null =>
  footer.kind === 'ask' || footer.kind === 'thinking' ? footer.helper : null;

export const stoppableRunOf = (footer: ChatFooter): Run | null =>
  footer.kind === 'thinking' ? footer.run : null;

export const stoppedWithSteps = (run: Run | null | undefined): Run | null =>
  run && (run.status === 'failed' || run.status === 'cancelled') && run.stepCount > 0 ? run : null;
