import {
  RUN_REQUEST_DEADLINE_MS,
  RUN_REQUEST_WAIT_MS,
  labelHead,
  requestIsOverdue,
  requestOfCall,
  type Run,
  type RunRequest,
} from '@tracker/shared';
import { retryDelay } from '../retry';
import { runName } from '../runName';
import { wait } from '../wait';
import type { WatchApi } from '../watchApi';
import { decisionOf, NO_ANSWER, RUN_ENDED, UNSHOWN } from './decisionOf';
import { deny, type PromptCall, type PromptDecision } from './promptCall';
import { CALL_CLOSED } from './promptSocket';
import { refusalOf, UNREACHABLE } from './trackerRefusal';

// A wait the tracker holds a little longer than it should is still answered, but one a proxy
// keeps open forever is dropped and asked again.
const WAIT_TIMEOUT_MS = RUN_REQUEST_WAIT_MS + 15_000;
// A tracker that can't be reached at the deadline can't say the request expired, so the helper
// says it itself a little after, counted on its own clock, which may differ from the tracker's.
const LOCAL_DEADLINE_MS = RUN_REQUEST_DEADLINE_MS + 60_000;
const CANCEL_TIMEOUT_MS = 10_000;

export interface AskPersonDeps {
  api: Pick<WatchApi, 'addRunRequest' | 'waitForRunRequest' | 'cancelRunRequest'>;
  runnerId: string;
  folder: string;
  log: (text: string) => void;
  describe: (error: unknown) => string;
  now?: () => number;
  retryDelay?: (attempt: number) => number;
}

export type AskPerson = (
  run: Run,
  call: PromptCall,
  signal: AbortSignal,
) => Promise<PromptDecision>;

type Ending = { request: RunRequest } | { gaveUp: string; note: string };

const gaveUp = (message: string): Ending => ({
  gaveUp: message,
  note: `stopped waiting: ${message}`,
});

const waitOnce = (deps: AskPersonDeps, id: string, signal: AbortSignal) =>
  deps.api.waitForRunRequest(id, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(WAIT_TIMEOUT_MS)]),
  });

async function untilEnded(
  deps: AskPersonDeps,
  request: RunRequest,
  signal: AbortSignal,
): Promise<Ending> {
  const now = deps.now ?? Date.now;
  const giveUpAt = now() + LOCAL_DEADLINE_MS;
  const delay = deps.retryDelay ?? retryDelay;
  let failures = 0;
  while (!signal.aborted) {
    try {
      const seen = await waitOnce(deps, request.id, signal);
      if (seen.status !== 'open') return { request: seen };
      failures = 0;
    } catch (error) {
      if (signal.aborted) break;
      const refusal = refusalOf(error);
      if (refusal) return gaveUp(refusal);
      if (requestIsOverdue(giveUpAt, now())) return gaveUp(NO_ANSWER);
      if (failures === 0) deps.log(`Waiting for the tracker: ${deps.describe(error)}`);
      await wait(delay(failures), signal);
      failures += 1;
    }
  }
  // Claude closing one call leaves the run going, so the window mustn't say the run stopped.
  const closed = signal.reason === CALL_CLOSED;
  const note = closed
    ? 'Claude stopped waiting for an answer.'
    : 'the run stopped before an answer.';
  return { gaveUp: RUN_ENDED, note };
}

// So the phone never shows a card nobody waits for. A tracker that can't take it ends the
// request itself once the run ends or the deadline passes.
async function endOnTracker(deps: AskPersonDeps, request: RunRequest): Promise<void> {
  try {
    await deps.api.cancelRunRequest(
      request.id,
      { runnerId: deps.runnerId },
      { signal: AbortSignal.timeout(CANCEL_TIMEOUT_MS) },
    );
  } catch {
    return;
  }
}

const ENDINGS: Readonly<Record<RunRequest['status'], string>> = {
  answered: 'the person answered',
  expired: 'nobody answered in time',
  cancelled: 'the run stopped before an answer',
  open: 'the run stopped before an answer',
};

async function ask(deps: AskPersonDeps, run: Run, call: PromptCall, signal: AbortSignal) {
  const input = requestOfCall(call.toolName, call.input, deps.folder);
  if (!input) return deny(UNSHOWN);
  let request: RunRequest;
  try {
    request = await deps.api.addRunRequest(run.id, { runnerId: deps.runnerId, ...input });
  } catch (error) {
    deps.log(`Couldn't ask on the phone for ${runName(run)}: ${deps.describe(error)}`);
    return deny(refusalOf(error) ?? UNREACHABLE);
  }
  deps.log(`${runName(run)}: Claude asks on the phone: ${labelHead(request.label)}`);
  const ending = await untilEnded(deps, request, signal);
  if ('request' in ending) {
    deps.log(`${runName(run)}: ${ENDINGS[ending.request.status]}.`);
    return decisionOf(call, ending.request);
  }
  await endOnTracker(deps, request);
  deps.log(`${runName(run)}: ${ending.note}`);
  return deny(ending.gaveUp);
}

export const createAskPerson =
  (deps: AskPersonDeps): AskPerson =>
  (run, call, signal) =>
    ask(deps, run, call, signal);
