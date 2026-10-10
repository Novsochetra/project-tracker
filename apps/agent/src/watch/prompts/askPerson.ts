import {
  RUN_REQUEST_DEADLINE_MS,
  RUN_REQUEST_WAIT_MS,
  requestIsOverdue,
  requestOfCall,
  type Run,
  type RunRequest,
} from '@tracker/shared';
import { retryDelay } from '../retry';
import { labelOf } from '../runLabel';
import { wait } from '../wait';
import type { WatchApi } from '../watchApi';
import { decisionOf, UNREACHABLE, UNSHOWN } from './decisionOf';
import { deny, type PromptCall, type PromptDecision } from './promptCall';

// A wait the tracker holds a little longer than it should is still answered, but one a proxy
// keeps open forever is dropped and asked again.
const WAIT_TIMEOUT_MS = RUN_REQUEST_WAIT_MS + 15_000;
// A tracker that can't be reached at the deadline can't say the request expired, so the helper
// says it itself a little after, counted on its own clock, which may differ from the tracker's.
const LOCAL_DEADLINE_MS = RUN_REQUEST_DEADLINE_MS + 60_000;

export interface AskPersonDeps {
  api: Pick<WatchApi, 'addRunRequest' | 'waitForRunRequest'>;
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

const waitOnce = (deps: AskPersonDeps, id: string, signal: AbortSignal) =>
  deps.api.waitForRunRequest(id, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(WAIT_TIMEOUT_MS)]),
  });

async function untilEnded(
  deps: AskPersonDeps,
  request: RunRequest,
  signal: AbortSignal,
): Promise<RunRequest> {
  const now = deps.now ?? Date.now;
  const giveUpAt = now() + LOCAL_DEADLINE_MS;
  const delay = deps.retryDelay ?? retryDelay;
  let failures = 0;
  while (!signal.aborted) {
    try {
      const seen = await waitOnce(deps, request.id, signal);
      if (seen.status !== 'open') return seen;
      failures = 0;
    } catch (error) {
      if (signal.aborted) break;
      if (requestIsOverdue(giveUpAt, now())) {
        return { ...request, status: 'expired' };
      }
      if (failures === 0) deps.log(`Waiting for the tracker: ${deps.describe(error)}`);
      await wait(delay(failures), signal);
      failures += 1;
    }
  }
  return { ...request, status: 'cancelled' };
}

const ENDINGS: Readonly<Record<RunRequest['status'], string>> = {
  answered: 'the person answered',
  expired: 'nobody answered in time',
  cancelled: 'the run stopped before an answer',
  open: 'the run stopped before an answer',
};

export const createAskPerson =
  (deps: AskPersonDeps): AskPerson =>
  async (run, call, signal) => {
    const input = requestOfCall(call.toolName, call.input, deps.folder);
    if (!input) return deny(UNSHOWN);
    let request: RunRequest;
    try {
      request = await deps.api.addRunRequest(run.id, { runnerId: deps.runnerId, ...input });
    } catch (error) {
      deps.log(`Couldn't ask on the phone for ${labelOf(run)}: ${deps.describe(error)}`);
      return deny(UNREACHABLE);
    }
    deps.log(`${labelOf(run)}: Claude asks on the phone: ${request.label}`);
    const ended = await untilEnded(deps, request, signal);
    deps.log(`${labelOf(run)}: ${ENDINGS[ended.status]}.`);
    return decisionOf(call, ended);
  };
