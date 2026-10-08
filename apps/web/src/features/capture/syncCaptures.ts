import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { isNotFound } from '../../api';
import type { Release } from './captureLocks';
import {
  dropCapture,
  findWaiting,
  markAttempted,
  markCreated,
  nextCapture,
  type QueuedCapture,
} from './captureQueue';
import type { QueueAccess } from './queueStore';

export interface SyncDeps {
  queue: QueueAccess;
  send: (capture: QueuedCapture) => Promise<Ticket>;
  // Whether the ticket for this capture already exists, for captures sent before.
  exists: (capture: QueuedCapture) => Promise<boolean>;
  // Takes the capture's lock for sending it; null while a request in any tab holds it.
  claim: (id: string) => Promise<Release | null>;
}

export interface SyncReport {
  added: QueuedCapture[];
  dropped: QueuedCapture[];
  // A failure ended the run, so captures are still waiting.
  stopped: boolean;
}

// Sent again later these get the same answer: the project is gone or the input is refused.
const RETRYABLE_CLIENT_STATUSES = new Set([401, 408, 429]);

const isRefused = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  !RETRYABLE_CLIENT_STATUSES.has(error.status);

type Step = 'added' | 'dropped' | 'stop';

// Only the create's own answer drops a capture: a lookup that fails keeps it for a later run.
// A 404 means its project is gone, so no ticket can exist and the create is left to say so.
async function alreadyCreated(capture: QueuedCapture, deps: SyncDeps): Promise<boolean | null> {
  if (!capture.attempted) return false;
  try {
    return await deps.exists(capture);
  } catch (error) {
    return isNotFound(error) ? false : null;
  }
}

async function syncOne(capture: QueuedCapture, deps: SyncDeps): Promise<Step> {
  const created = await alreadyCreated(capture, deps);
  if (created === null) return 'stop';
  if (created) return 'added';
  // Written before sending, so a reload mid-request still checks before sending again.
  if (!deps.queue.update((queue) => markAttempted(queue, capture.id))) return 'stop';
  try {
    await deps.send(capture);
    return 'added';
  } catch (error) {
    return isRefused(error) ? 'dropped' : 'stop';
  }
}

function settle(capture: QueuedCapture, step: Step, deps: SyncDeps, report: SyncReport): boolean {
  if (step === 'stop') return false;
  report[step].push(capture);
  const settled = step === 'added' ? markCreated : dropCapture;
  return deps.queue.update((queue) => settled(queue, capture.id));
}

// Sent only while this run holds the capture's lock, and read again once it does: until then
// another tab may have sent it or marked it attempted.
async function syncClaimed(id: string, deps: SyncDeps, report: SyncReport): Promise<boolean> {
  const release = await deps.claim(id);
  if (!release) return true;
  try {
    const capture = findWaiting(deps.queue.read(), id);
    return capture ? settle(capture, await syncOne(capture, deps), deps, report) : true;
  } finally {
    release();
  }
}

// Sends waiting captures oldest first, one at a time, and stops at the first failure.
export async function syncCaptures(deps: SyncDeps): Promise<SyncReport> {
  const report: SyncReport = { added: [], dropped: [], stopped: false };
  // Every capture is tried at most once per run, even if its result could not be saved.
  const seen = new Set<string>();
  // Read before each capture: a slow request from the sheet can join the queue mid-run.
  let capture = nextCapture(deps.queue.read(), seen);
  while (capture) {
    seen.add(capture.id);
    if (!(await syncClaimed(capture.id, deps, report))) return { ...report, stopped: true };
    capture = nextCapture(deps.queue.read(), seen);
  }
  return report;
}
