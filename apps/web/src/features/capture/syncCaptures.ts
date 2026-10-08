import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import type { Release } from './captureLocks';
import {
  dropCapture,
  findWaiting,
  markCreated,
  nextCapture,
  type QueuedCapture,
} from './captureQueue';
import type { QueueAccess } from './queueStore';
import { TextNotSavedError } from './sendCapture';

export interface SyncDeps {
  queue: QueueAccess;
  send: (capture: QueuedCapture) => Promise<Ticket>;
  claim: (id: string) => Promise<Release | null>;
}

export interface SyncReport {
  added: QueuedCapture[];
  // Keys of tickets added with the text of an earlier create: the later text was refused.
  unsaved: string[];
  dropped: QueuedCapture[];
  stopped: boolean;
}

// Sent again later these get the same answer: the project is gone or the input is refused.
const RETRYABLE_CLIENT_STATUSES = new Set([401, 408, 429]);

const isRefused = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  !RETRYABLE_CLIENT_STATUSES.has(error.status);

type Step = { kind: 'added'; unsaved?: string } | { kind: 'dropped' } | { kind: 'stop' };

// A capture an earlier request may have created is simply sent again: its client id gets the
// ticket that request made. When only its later text is refused, that ticket exists, so the
// capture is added all the same.
async function syncOne(capture: QueuedCapture, deps: SyncDeps): Promise<Step> {
  try {
    await deps.send(capture);
    return { kind: 'added' };
  } catch (error) {
    if (!isRefused(error)) return { kind: 'stop' };
    if (error instanceof TextNotSavedError) return { kind: 'added', unsaved: error.ticketKey };
    return { kind: 'dropped' };
  }
}

function settle(capture: QueuedCapture, step: Step, deps: SyncDeps, report: SyncReport): boolean {
  if (step.kind === 'stop') return false;
  report[step.kind].push(capture);
  if (step.kind === 'added' && step.unsaved) report.unsaved.push(step.unsaved);
  const settled = step.kind === 'added' ? markCreated : dropCapture;
  return deps.queue.update((queue) => settled(queue, capture.id));
}

// Sent only while this run holds the capture's lock, and read again once it does: until then
// another tab may have sent it.
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

export async function syncCaptures(deps: SyncDeps): Promise<SyncReport> {
  const report: SyncReport = { added: [], unsaved: [], dropped: [], stopped: false };
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
