export const LIVE_RETRY_MS = 1_000;
export const LIVE_MAX_RETRY_MS = 15_000;

// A restarting server is usually back within a second or two; one that stays down is asked less often.
export const retryDelay = (failedAttempts: number): number =>
  Math.min(LIVE_RETRY_MS * 2 ** failedAttempts, LIVE_MAX_RETRY_MS);
