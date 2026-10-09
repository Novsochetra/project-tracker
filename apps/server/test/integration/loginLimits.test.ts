import type { ErrorBody } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LOGIN_LIMITS } from '../../src/auth/loginLimits';
import { addOwner, loginRequest, OWNER, testClock } from '../helpers/auth';
import { DIALECTS, useTestServer } from '../helpers/server';

const WINDOW = 15 * 60 * 1000;
const WRONG = { email: OWNER.email, password: 'not the password' };

describe.each(DIALECTS)('sign-in limits (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, {
    now: clock.now,
    auth: {
      trustedProxies: 1,
      loginLimits: {
        perAddress: { max: 3, windowMs: WINDOW },
        perAccount: { max: 5, windowMs: WINDOW },
      },
    },
  });

  const attempt = (credentials = WRONG, address = '203.0.113.7', forwarded?: string) =>
    api.app.request(
      '/api/session',
      loginRequest(credentials, { 'x-forwarded-for': forwarded ?? `198.51.100.1, ${address}` }),
    );

  // The limits live as long as the app, which the tests share: moving past the window clears them.
  beforeEach(async () => {
    clock.advance(2 * WINDOW);
    await addOwner(api.db);
  });

  it('refuses an address after its wrong tries, even with the right password', async () => {
    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const refused = await attempt(OWNER);
    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toBe(String(WINDOW / 1000));
    expect(((await refused.json()) as ErrorBody).error).toEqual({
      code: 'rate_limited',
      message: 'Too many sign-in attempts. Try again in 15 minutes.',
    });
    expect(refused.headers.get('set-cookie')).toBeNull();

    clock.advance(WINDOW - 60_000);
    const later = await attempt(OWNER);
    expect(((await later.json()) as ErrorBody).error.message).toBe(
      'Too many sign-in attempts. Try again in a minute.',
    );
    clock.advance(60_000);
    expect((await attempt(OWNER)).status).toBe(200);
  });

  it('keeps other addresses signing in', async () => {
    for (let i = 0; i < 3; i += 1) await attempt();
    expect((await attempt(OWNER)).status).toBe(429);
    expect((await attempt(OWNER, '203.0.113.8')).status).toBe(200);
  });

  it('reads the address the trusted proxy added, not one the client made up', async () => {
    for (let i = 0; i < 3; i += 1) {
      await attempt(WRONG, '203.0.113.7', `10.0.0.${i}, 203.0.113.7`);
    }
    expect((await attempt(OWNER, '203.0.113.7', '10.9.9.9, 203.0.113.7')).status).toBe(429);
  });

  it('limits the account across addresses', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await attempt(WRONG, `203.0.113.${i}`)).status).toBe(401);
    }
    expect((await attempt(OWNER, '203.0.113.99')).status).toBe(429);
    const otherEmail = { email: 'someone@example.com', password: 'x' };
    expect((await attempt(otherEmail, '203.0.113.99')).status).toBe(401);
    const sameEmail = { email: ' OWNER@example.com', password: 'x' };
    expect((await attempt(sameEmail, '203.0.113.98')).status).toBe(429);
  });

  it('starts counting again after a successful sign-in', async () => {
    for (let i = 0; i < 2; i += 1) await attempt();
    expect((await attempt(OWNER)).status).toBe(200);
    for (let i = 0; i < 2; i += 1) expect((await attempt()).status).toBe(401);
    expect((await attempt(OWNER)).status).toBe(200);
  });

  it('counts tries sent side by side before any of them is checked', async () => {
    const answers = await Promise.all(Array.from({ length: 6 }, async () => attempt()));
    const statuses = answers.map((answer) => answer.status).sort();
    expect(statuses).toEqual([401, 401, 401, 429, 429, 429]);
  });

  it('defaults to 10 tries per address and 30 per account in 15 minutes', () => {
    expect(DEFAULT_LOGIN_LIMITS).toEqual({
      perAddress: { max: 10, windowMs: WINDOW },
      perAccount: { max: 30, windowMs: WINDOW },
    });
  });
});

describe('sign-in limits without a trusted proxy', () => {
  const api = useTestServer('sqlite', {
    auth: { loginLimits: { ...DEFAULT_LOGIN_LIMITS, perAddress: { max: 2, windowMs: WINDOW } } },
  });

  beforeEach(async () => {
    await addOwner(api.db);
  });

  it('ignores X-Forwarded-For, which anyone can send', async () => {
    for (let i = 0; i < 2; i += 1) {
      await api.app.request(
        '/api/session',
        loginRequest(WRONG, { 'x-forwarded-for': `10.0.0.${i}` }),
      );
    }
    const res = await api.app.request(
      '/api/session',
      loginRequest(OWNER, { 'x-forwarded-for': '10.0.0.99' }),
    );
    expect(res.status).toBe(429);
  });
});
