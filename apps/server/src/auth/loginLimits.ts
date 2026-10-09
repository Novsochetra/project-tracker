import { normalizeEmail } from '@tracker/shared';
import { createRateLimiter, type RateLimit } from './rateLimiter';

export interface LoginLimitOptions {
  perAddress: RateLimit;
  perAccount: RateLimit;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// One address gets 10 wrong tries per 15 minutes. The account gets more, from all addresses
// together, so guessing from many addresses stays slow while one bad actor can't lock the owner
// out for long.
export const DEFAULT_LOGIN_LIMITS: LoginLimitOptions = {
  perAddress: { max: 10, windowMs: FIFTEEN_MINUTES },
  perAccount: { max: 30, windowMs: FIFTEEN_MINUTES },
};

export interface LoginAttempt {
  address: string;
  email: string;
}

export interface LoginLimits {
  waitFor(attempt: LoginAttempt, now: number): number;
  failed(attempt: LoginAttempt, now: number): void;
  succeeded(attempt: LoginAttempt): void;
}

export function createLoginLimits(options: LoginLimitOptions = DEFAULT_LOGIN_LIMITS): LoginLimits {
  const addresses = createRateLimiter(options.perAddress);
  const accounts = createRateLimiter(options.perAccount);
  const account = (attempt: LoginAttempt) => normalizeEmail(attempt.email);
  return {
    waitFor: (attempt, now) =>
      Math.max(addresses.waitFor(attempt.address, now), accounts.waitFor(account(attempt), now)),
    failed: (attempt, now) => {
      addresses.fail(attempt.address, now);
      accounts.fail(account(attempt), now);
    },
    succeeded: (attempt) => {
      addresses.clear(attempt.address);
      accounts.clear(account(attempt));
    },
  };
}
