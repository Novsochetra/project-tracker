import { describe, expect, it } from 'vitest';
import { LIVE_MAX_RETRY_MS, LIVE_RETRY_MS, retryDelay } from './backoff';

describe('retryDelay', () => {
  it('doubles the wait after each failed attempt up to a ceiling', () => {
    expect([0, 1, 2, 3].map(retryDelay)).toEqual([1, 2, 4, 8].map((n) => n * LIVE_RETRY_MS));
    expect(retryDelay(4)).toBe(LIVE_MAX_RETRY_MS);
    expect(retryDelay(50)).toBe(LIVE_MAX_RETRY_MS);
  });
});
