import { describe, expect, it } from 'vitest';
import { createLoginLimits } from '../../src/auth/loginLimits';
import { createRateLimiter } from '../../src/auth/rateLimiter';

describe('createRateLimiter', () => {
  it('lets a key fail max times in a window, then makes it wait for the window to end', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000 });
    expect(limiter.waitFor('a', 0)).toBe(0);
    limiter.fail('a', 0);
    expect(limiter.waitFor('a', 100)).toBe(0);
    limiter.fail('a', 100);
    expect(limiter.waitFor('a', 400)).toBe(600);
    expect(limiter.waitFor('b', 400)).toBe(0);
    expect(limiter.waitFor('a', 1000)).toBe(0);
  });

  it('starts a fresh window once the last one ended', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    limiter.fail('a', 0);
    limiter.fail('a', 1500);
    expect(limiter.waitFor('a', 1600)).toBe(900);
  });

  it('forgets a key once cleared', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    limiter.fail('a', 0);
    limiter.clear('a');
    expect(limiter.waitFor('a', 1)).toBe(0);
  });

  it('keeps at most 10,000 keys, dropping the oldest', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    for (let i = 0; i <= 10_000; i += 1) limiter.fail(`k${i}`, 0);
    expect(limiter.waitFor('k0', 1)).toBe(0);
    expect(limiter.waitFor('k10000', 1)).toBe(999);
    expect(limiter.waitFor('k1', 1)).toBe(999);
  });
});

describe('createLoginLimits', () => {
  const limits = () =>
    createLoginLimits({
      perAddress: { max: 2, windowMs: 1000 },
      perAccount: { max: 3, windowMs: 2000 },
    });

  it('waits for whichever limit is further away', () => {
    const login = limits();
    login.failed({ address: 'a', email: 'owner@example.com' }, 0);
    login.failed({ address: 'b', email: 'Owner@Example.com ' }, 0);
    login.failed({ address: 'a', email: 'OWNER@example.com' }, 0);
    expect(login.waitFor({ address: 'c', email: 'owner@example.com' }, 500)).toBe(1500);
    expect(login.waitFor({ address: 'a', email: 'other@example.com' }, 500)).toBe(500);
  });

  it('clears both the address and the account after a success', () => {
    const login = limits();
    const attempt = { address: 'a', email: 'owner@example.com' };
    login.failed(attempt, 0);
    login.failed(attempt, 0);
    login.succeeded(attempt);
    expect(login.waitFor(attempt, 1)).toBe(0);
  });
});
