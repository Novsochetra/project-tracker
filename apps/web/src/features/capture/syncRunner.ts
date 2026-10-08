import type { SyncReport } from './syncCaptures';

const LOCK_NAME = 'tracker-capture-sync';
const NOTHING: SyncReport = { added: [], dropped: [], stopped: false };

let running: Promise<SyncReport> | null = null;
const sending = new Set<string>();

// Another tab that holds the lock is sending the same queue, so this one skips its turn.
function withTabLock(run: () => Promise<SyncReport>): Promise<SyncReport> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return run();
  return locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => (lock ? run() : NOTHING));
}

/** Runs one sync at a time: a call while one runs joins it instead of sending twice. */
export function runCaptureSync(run: () => Promise<SyncReport>): Promise<SyncReport> {
  running ??= withTabLock(run).finally(() => {
    running = null;
  });
  return running;
}

/** Marks a capture whose request is still out, so a sync doesn't send it a second time. */
export function trackSending(id: string): () => void {
  sending.add(id);
  return () => {
    sending.delete(id);
  };
}

export const capturesSending = (): ReadonlySet<string> => new Set(sending);
