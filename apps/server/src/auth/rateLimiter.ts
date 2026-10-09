export interface RateLimit {
  max: number;
  windowMs: number;
}

export interface RateLimiter {
  // Milliseconds until the key may try again, or 0 when it may now.
  waitFor(key: string, now: number): number;
  fail(key: string, now: number): void;
  clear(key: string): void;
}

interface Window {
  count: number;
  endsAt: number;
}

// Kept in memory: the tracker runs as one process. Keys come from requests (addresses, typed
// emails), so the map is capped and an attacker can't grow it without bound.
const MAX_KEYS = 10_000;

function dropOld(windows: Map<string, Window>, now: number): void {
  for (const [key, window] of windows) if (window.endsAt <= now) windows.delete(key);
  // Maps iterate in insertion order, so what is left over the cap goes oldest first.
  for (const key of windows.keys()) {
    if (windows.size < MAX_KEYS) break;
    windows.delete(key);
  }
}

export function createRateLimiter({ max, windowMs }: RateLimit): RateLimiter {
  const windows = new Map<string, Window>();
  const current = (key: string, now: number): Window | undefined => {
    const window = windows.get(key);
    if (window && window.endsAt <= now) windows.delete(key);
    return window && window.endsAt > now ? window : undefined;
  };
  return {
    waitFor: (key, now) => {
      const window = current(key, now);
      return window && window.count >= max ? window.endsAt - now : 0;
    },
    fail: (key, now) => {
      const window = current(key, now);
      if (window) {
        window.count += 1;
        return;
      }
      if (windows.size >= MAX_KEYS) dropOld(windows, now);
      windows.set(key, { count: 1, endsAt: now + windowMs });
    },
    clear: (key) => {
      windows.delete(key);
    },
  };
}
