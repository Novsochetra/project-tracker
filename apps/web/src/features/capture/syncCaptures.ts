import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { errorMessage } from '../../api';
import {
  dropCapture,
  markAttempted,
  markCreated,
  nextCapture,
  type QueuedCapture,
} from './captureQueue';
import type { QueueAccess } from './queueStore';

export interface SyncDeps {
  queue: QueueAccess;
  send: (capture: QueuedCapture) => Promise<Ticket>;
  /** Whether the ticket for this capture already exists, for captures sent before. */
  exists: (capture: QueuedCapture) => Promise<boolean>;
  /** Captures another request is sending right now; they are left alone. */
  busy?: () => ReadonlySet<string>;
}

export interface DroppedCapture {
  capture: QueuedCapture;
  message: string;
}

export interface SyncReport {
  added: QueuedCapture[];
  dropped: DroppedCapture[];
  /** A failure ended the run, so captures are still waiting. */
  stopped: boolean;
}

// Sent again later these get the same answer: the project is gone or the input is refused.
const RETRYABLE_CLIENT_STATUSES = new Set([401, 408, 429]);

const isRejected = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  !RETRYABLE_CLIENT_STATUSES.has(error.status);

type Step = { kind: 'added' } | { kind: 'dropped'; message: string } | { kind: 'stop' };

async function syncOne(capture: QueuedCapture, deps: SyncDeps): Promise<Step> {
  try {
    if (capture.attempted && (await deps.exists(capture))) return { kind: 'added' };
    // Written before sending, so a reload mid-request still checks before sending again.
    if (!deps.queue.update((queue) => markAttempted(queue, capture.id))) return { kind: 'stop' };
    await deps.send(capture);
    return { kind: 'added' };
  } catch (error) {
    return isRejected(error) ? { kind: 'dropped', message: errorMessage(error) } : { kind: 'stop' };
  }
}

function settle(capture: QueuedCapture, step: Step, deps: SyncDeps, report: SyncReport): boolean {
  if (step.kind === 'added') {
    report.added.push(capture);
    return deps.queue.update((queue) => markCreated(queue, capture.id));
  }
  if (step.kind === 'dropped') {
    report.dropped.push({ capture, message: step.message });
    return deps.queue.update((queue) => dropCapture(queue, capture.id));
  }
  return false;
}

/** Sends waiting captures oldest first, one at a time, and stops at the first failure. */
export async function syncCaptures(deps: SyncDeps): Promise<SyncReport> {
  const report: SyncReport = { added: [], dropped: [], stopped: false };
  // Every capture is tried at most once per run, even if its result could not be saved.
  const seen = new Set<string>();
  // Asked before each capture: a slow request from the sheet can join the queue mid-run.
  const next = () => nextCapture(deps.queue.read(), new Set([...seen, ...(deps.busy?.() ?? [])]));
  let capture = next();
  while (capture) {
    seen.add(capture.id);
    const step = await syncOne(capture, deps);
    if (!settle(capture, step, deps, report)) return { ...report, stopped: true };
    capture = next();
  }
  return report;
}

const CLOCK_SKEW_MS = 5 * 60_000;

/** The ticket an earlier request made for this capture, judged by its text and time. */
export const matchesCapture = (ticket: Ticket, capture: QueuedCapture): boolean =>
  ticket.title === capture.title &&
  ticket.description === capture.description &&
  ticket.createdAt >= capture.capturedAt - CLOCK_SKEW_MS;
