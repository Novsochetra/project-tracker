import { browserLockPlatform, createCaptureLocks, type Release } from './captureLocks';
import type { SyncReport } from './syncCaptures';

const LOCK_NAME = 'tracker-capture-sync';
const NOTHING: SyncReport = { added: [], dropped: [], stopped: false };

let running: Promise<SyncReport> | null = null;
const captureLocks = createCaptureLocks(browserLockPlatform);

// Another tab that holds the lock is sending the same queue, so this one skips its turn.
function withTabLock(run: () => Promise<SyncReport>): Promise<SyncReport> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return run();
  return locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => (lock ? run() : NOTHING));
}

// One sync at a time: a call while one runs joins it instead of sending twice.
export function runCaptureSync(run: () => Promise<SyncReport>): Promise<SyncReport> {
  running ??= withTabLock(run).finally(() => {
    running = null;
  });
  return running;
}

// Held while the sheet's request is out, so no sync in any tab sends the capture meanwhile.
export const trackSending = (id: string): Release => captureLocks.hold(id);

export const claimCapture = (id: string): Promise<Release | null> => captureLocks.claim(id);
