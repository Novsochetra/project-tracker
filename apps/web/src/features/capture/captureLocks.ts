export type Release = () => void;

export interface CaptureLocks {
  // For this tab's own request: other tabs leave the capture alone until it is released.
  hold: (id: string) => Release;
  // For a sync about to send a capture: null while a request in any tab holds it.
  claim: (id: string) => Promise<Release | null>;
}

export interface LockPlatform {
  locks: () => LockManager | undefined;
  storage: () => Storage | undefined;
  now: () => number;
}

// Shared with every open tab, whichever build it runs.
const lockName = (id: string): string => `tracker-capture-send:${id}`;
const leaseKey = (id: string): string => `tracker.capture.sending.${id}`;

// Renewed while the request is out; a tab that closes mid-request stops blocking within a minute.
const LEASE_MS = 60_000;
const RENEW_MS = 20_000;

const once = (run: () => void): Release => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    run();
  };
};

function heldUntilReleased(): { held: Promise<void>; release: Release } {
  let release: Release = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { held, release };
}

function holdWebLock(locks: LockManager, id: string): Release {
  const { held, release } = heldUntilReleased();
  locks.request(lockName(id), () => held).catch(() => undefined);
  return release;
}

// A lock request that fails would otherwise keep the capture waiting forever; it goes out unlocked.
function claimWebLock(locks: LockManager, id: string): Promise<Release | null> {
  const { held, release } = heldUntilReleased();
  return new Promise((resolve) => {
    locks
      .request(lockName(id), { ifAvailable: true }, (lock) => {
        resolve(lock ? release : null);
        return lock ? held : undefined;
      })
      .catch(() => resolve(release));
  });
}

// Storage that refuses a write only costs the other tabs their view of the lease.
function tryStorage<T>(access: () => T, fallback: T): T {
  try {
    return access();
  } catch {
    return fallback;
  }
}

const isLeased = (storage: Storage, id: string, now: number): boolean =>
  tryStorage(() => Number(storage.getItem(leaseKey(id))) > now, false);

function takeLease(storage: Storage, id: string, now: () => number): Release {
  const write = () => storage.setItem(leaseKey(id), String(now() + LEASE_MS));
  const renew = () => tryStorage(write, undefined);
  renew();
  const timer = setInterval(renew, RENEW_MS);
  return () => {
    clearInterval(timer);
    tryStorage(() => storage.removeItem(leaseKey(id)), undefined);
  };
}

function holdAcrossTabs(platform: LockPlatform, id: string): Release {
  const locks = platform.locks();
  if (locks) return holdWebLock(locks, id);
  const storage = platform.storage();
  return storage ? takeLease(storage, id, platform.now) : () => undefined;
}

function claimAcrossTabs(platform: LockPlatform, id: string): Promise<Release | null> {
  const locks = platform.locks();
  if (locks) return claimWebLock(locks, id);
  const storage = platform.storage();
  if (!storage) return Promise.resolve(() => undefined);
  if (isLeased(storage, id, platform.now())) return Promise.resolve(null);
  return Promise.resolve(takeLease(storage, id, platform.now));
}

// Web Locks where the browser has them (they need a secure context), otherwise a lease time in
// localStorage. This tab's own requests are also kept in memory, so it knows of them at once.
export function createCaptureLocks(platform: LockPlatform): CaptureLocks {
  const sending = new Set<string>();
  const tracked = (id: string, release: Release): Release =>
    once(() => {
      sending.delete(id);
      release();
    });
  return {
    hold: (id) => {
      sending.add(id);
      return tracked(id, holdAcrossTabs(platform, id));
    },
    claim: async (id) => {
      if (sending.has(id)) return null;
      sending.add(id);
      const release = await claimAcrossTabs(platform, id);
      if (release) return tracked(id, release);
      sending.delete(id);
      return null;
    },
  };
}

export const browserLockPlatform: LockPlatform = {
  locks: () => (typeof navigator === 'undefined' ? undefined : navigator.locks),
  storage: () => tryStorage<Storage | undefined>(() => window.localStorage, undefined),
  now: () => Date.now(),
};
