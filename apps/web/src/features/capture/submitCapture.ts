import type { Ticket } from '@tracker/shared';
import { errorMessage, isNetworkError, NETWORK_ERROR_MESSAGE } from '../../api';
import type { QueuedCapture } from './captureQueue';

export interface CaptureDraft {
  capture: QueuedCapture;
  attachmentIds: readonly string[];
}

export type SubmitOutcome =
  | { kind: 'created'; ticket: Ticket }
  | { kind: 'saved' }
  | { kind: 'needsConnection' }
  | { kind: 'failed'; message: string };

export interface SubmitDeps {
  create: (draft: CaptureDraft) => Promise<Ticket>;
  // Puts the capture in the queue on this device; false when storage refused it.
  save: (capture: QueuedCapture) => boolean;
  // Marks the capture as being sent, in every tab, and returns the function that unmarks it.
  track: (id: string) => () => void;
  // A request that outlived the timeout settled: its ticket, or null when it failed.
  onLateResult: (capture: QueuedCapture, ticket: Ticket | null) => void;
  timeoutMs: number;
  isOffline: () => boolean;
}

type Settled = { kind: 'created'; ticket: Ticket } | { kind: 'error'; error: unknown };

const settle = (request: Promise<Ticket>): Promise<Settled> =>
  request.then(
    (ticket) => ({ kind: 'created', ticket }),
    (error: unknown) => ({ kind: 'error', error }),
  );

function within(request: Promise<Ticket>, ms: number | null): Promise<Settled | 'late'> {
  if (ms === null) return settle(request);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>((resolve) => {
    timer = setTimeout(() => resolve('late'), ms);
  });
  return Promise.race([settle(request), late]).finally(() => clearTimeout(timer));
}

function afterSettled(draft: CaptureDraft, settled: Settled, deps: SubmitDeps): SubmitOutcome {
  if (settled.kind === 'created') return settled;
  const { error } = settled;
  if (!isNetworkError(error)) return { kind: 'failed', message: errorMessage(error) };
  // Photos only live on the server, so a capture with photos can't wait on the phone.
  if (draft.attachmentIds.length > 0) return { kind: 'needsConnection' };
  // Offline the request never left; otherwise the answer may be what got lost.
  const capture = { ...draft.capture, attempted: !deps.isOffline() };
  return deps.save(capture)
    ? { kind: 'saved' }
    : { kind: 'failed', message: NETWORK_ERROR_MESSAGE };
}

async function keepSending(
  draft: CaptureDraft,
  request: Promise<Ticket>,
  deps: SubmitDeps,
  untrack: () => void,
): Promise<SubmitOutcome> {
  const { capture } = draft;
  if (!deps.save({ ...capture, attempted: true })) {
    const settled = await settle(request);
    untrack();
    return afterSettled(draft, settled, deps);
  }
  // Unmarked only once the result is recorded, so no tab sends the queued copy in between.
  void settle(request).then((settled) => {
    try {
      deps.onLateResult(capture, settled.kind === 'created' ? settled.ticket : null);
    } finally {
      untrack();
    }
  });
  return { kind: 'saved' };
}

// When the tracker can't be reached, or doesn't answer in time, a text-only capture waits in the
// queue on this device; a slow request may still land, and then the queued copy is marked created
// rather than sent again.
export async function submitCapture(draft: CaptureDraft, deps: SubmitDeps): Promise<SubmitOutcome> {
  const untrack = deps.track(draft.capture.id);
  const request = deps.create(draft);
  const first = await within(request, draft.attachmentIds.length > 0 ? null : deps.timeoutMs);
  if (first === 'late') return keepSending(draft, request, deps, untrack);
  untrack();
  return afterSettled(draft, first, deps);
}
