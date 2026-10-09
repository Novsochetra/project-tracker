import type { ErrorBody, SessionState } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { SESSION_IDLE_MS, SESSION_MAX_MS, SESSION_RENEW_AFTER_MS } from '../../src/auth/sessions';
import { hashSecret } from '../../src/auth/secrets';
import {
  addOwner,
  cookieOf,
  JSON_HEADERS,
  loginRequest,
  OWNER,
  signIn,
  testClock,
} from '../helpers/auth';
import { clientFor, DIALECTS, useTestServer } from '../helpers/server';

const DAY = 24 * 60 * 60 * 1000;

describe.each(DIALECTS)('sessions (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const app = () => api.app;
  const read = (cookie: string) => app().request('/api/projects', { headers: { cookie } });

  beforeEach(async () => {
    clock.set(1_000_000);
    await addOwner(api.db);
  });

  it('signs the owner in with an HttpOnly, SameSite=Lax session cookie', async () => {
    const res = await app().request('/api/session', loginRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authRequired: true,
      authenticated: true,
      email: OWNER.email,
    });
    const header = res.headers.get('set-cookie') ?? '';
    expect(header).toMatch(/^tracker_session=[\w-]{43};/);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).toContain(`Max-Age=${SESSION_IDLE_MS / 1000}`);
    expect(header).not.toContain('Secure');
    const cookie = cookieOf(res);
    expect((await read(cookie)).status).toBe(200);
    expect(await (await app().request('/api/session', { headers: { cookie } })).json()).toEqual({
      authRequired: true,
      authenticated: true,
      email: OWNER.email,
    });
  });

  it('keeps only a hash of the cookie in the database', async () => {
    const cookie = await signIn(app());
    const secret = cookie.split('=')[1]!;
    const rows = await api.db.selectFrom('sessions').selectAll().execute();
    expect(rows.map((row) => row.id)).toEqual([hashSecret(secret)]);
    expect(JSON.stringify(rows)).not.toContain(secret);
  });

  it('ignores the case of the email', async () => {
    const res = await app().request(
      '/api/session',
      loginRequest({ email: '  Owner@Example.COM ', password: OWNER.password }),
    );
    expect(res.status).toBe(200);
  });

  it('gives the same answer for a wrong email and a wrong password, and sets no cookie', async () => {
    for (const credentials of [
      { email: OWNER.email, password: 'wrong password!' },
      { email: 'someone@example.com', password: OWNER.password },
      { email: OWNER.email, password: OWNER.password.toUpperCase() },
    ]) {
      const res = await app().request('/api/session', loginRequest(credentials));
      expect(res.status).toBe(401);
      expect(((await res.json()) as ErrorBody).error).toEqual({
        code: 'unauthorized',
        message: 'Email or password is incorrect.',
      });
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  it('asks for both fields', async () => {
    const res = await app().request('/api/session', loginRequest({ email: ' ', password: '' }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error.message).toBe('Enter your email and password.');
  });

  it('marks the cookie Secure on https, behind a trusted proxy and in production', async () => {
    const https = await app().request('https://tracker.example/api/session', loginRequest());
    expect(https.headers.get('set-cookie')).toContain('Secure');

    const proxied = { 'x-forwarded-proto': 'https' };
    const untrusted = await app().request('/api/session', loginRequest(OWNER, proxied));
    expect(untrusted.headers.get('set-cookie')).not.toContain('Secure');
    const behindProxy = createApp({
      db: api.db,
      storage: api.storage,
      events: api.broadcaster,
      auth: { trustedProxies: 1 },
    });
    const trusted = await behindProxy.request('/api/session', loginRequest(OWNER, proxied));
    expect(trusted.headers.get('set-cookie')).toContain('Secure');

    const production = createApp({
      db: api.db,
      storage: api.storage,
      events: api.broadcaster,
      auth: { secureCookies: true },
    });
    const plain = await production.request('/api/session', loginRequest());
    expect(plain.headers.get('set-cookie')).toContain('Secure');
  });

  it('signs out this device: the session ends and the cookie and caches are cleared', async () => {
    const cookie = await signIn(app());
    const other = await signIn(app());
    const res = await app().request('/api/session', { method: 'DELETE', headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authRequired: true, authenticated: false });
    expect(res.headers.get('set-cookie')).toMatch(/^tracker_session=;.*Max-Age=0/);
    expect(res.headers.get('clear-site-data')).toBe('"cache"');
    expect((await read(cookie)).status).toBe(401);
    expect((await read(other)).status).toBe(200);
  });

  it('signs out a device whose session has already ended', async () => {
    const res = await app().request('/api/session', {
      method: 'DELETE',
      headers: { cookie: 'tracker_session=gone' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('signs out everywhere, while API tokens keep working', async () => {
    const phone = await signIn(app());
    const laptop = await signIn(app());
    const token = await clientFor(app()).login(OWNER);
    expect(token.authenticated).toBe(true);
    const created = await app().request('/api/tokens', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie: laptop },
      body: JSON.stringify({ name: 'Claude laptop' }),
    });
    const { secret } = (await created.json()) as { secret: string };

    const res = await app().request('/api/sessions', {
      method: 'DELETE',
      headers: { cookie: phone },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authRequired: true, authenticated: false });
    expect(res.headers.get('clear-site-data')).toBe('"cache"');
    expect(await api.db.selectFrom('sessions').select('id').execute()).toEqual([]);
    expect((await read(phone)).status).toBe(401);
    expect((await read(laptop)).status).toBe(401);
    const agent = await app().request('/api/projects', {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(agent.status).toBe(200);
  });

  it('ends the previous session when the same browser signs in again', async () => {
    const first = await signIn(app());
    const second = await app().request('/api/session', loginRequest(OWNER, { cookie: first }));
    expect(second.status).toBe(200);
    expect((await read(first)).status).toBe(401);
    expect((await read(cookieOf(second))).status).toBe(200);
  });

  it('clears a cookie the server does not know', async () => {
    const res = await app().request('/api/session', {
      headers: { cookie: 'tracker_session=forged' },
    });
    expect(((await res.json()) as SessionState).authenticated).toBe(false);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('renews a session in use at most once a day, up to the longest a session lasts', async () => {
    const cookie = await signIn(app());
    clock.advance(SESSION_RENEW_AFTER_MS - 1);
    expect((await read(cookie)).headers.get('set-cookie')).toBeNull();

    clock.advance(1);
    const renewed = await read(cookie);
    expect(renewed.status).toBe(200);
    expect(renewed.headers.get('set-cookie')).toContain(`Max-Age=${SESSION_IDLE_MS / 1000}`);

    for (let day = 0; day < SESSION_MAX_MS / DAY - 3; day += 1) {
      clock.advance(DAY);
      expect((await read(cookie)).status).toBe(200);
    }
    clock.advance(DAY);
    const last = await read(cookie);
    expect(last.status).toBe(200);
    expect(last.headers.get('set-cookie')).toContain(`Max-Age=${DAY / 1000}`);
    clock.advance(DAY);
    expect((await read(cookie)).status).toBe(401);
  });

  it('ends a session left unused for 30 days, and sweeps ended ones at the next sign-in', async () => {
    const used = await signIn(app());
    clock.advance(SESSION_IDLE_MS - 1);
    expect((await read(used)).status).toBe(200);
    const unused = await signIn(app());
    clock.advance(SESSION_IDLE_MS);
    expect((await read(unused)).status).toBe(401);
    expect((await read(used)).status).toBe(401);
    expect(await api.db.selectFrom('sessions').select('id').execute()).toHaveLength(0);

    await signIn(app());
    const another = await signIn(app());
    clock.advance(SESSION_IDLE_MS);
    await signIn(app());
    expect((await read(another)).status).toBe(401);
    expect(await api.db.selectFrom('sessions').select('id').execute()).toHaveLength(1);
  });

  it('refuses writes another site sends with the cookie', async () => {
    const cookie = await signIn(app());
    const write = (site: string) =>
      app().request('/api/projects', {
        method: 'POST',
        headers: { ...JSON_HEADERS, cookie, 'sec-fetch-site': site },
        body: JSON.stringify({ name: 'From afar' }),
      });
    for (const site of ['cross-site', 'same-site']) {
      const res = await write(site);
      expect(res.status, site).toBe(403);
      expect(((await res.json()) as ErrorBody).error.code).toBe('forbidden');
    }
    expect((await write('same-origin')).status).toBe(201);
    const read = await app().request('/api/projects', {
      headers: { cookie, 'sec-fetch-site': 'cross-site' },
    });
    expect(read.status).toBe(200);
  });

  it('tells the Connect sheet that sign-in is on', async () => {
    const cookie = await signIn(app());
    const meta = await app().request('/api/meta', { headers: { cookie } });
    expect(((await meta.json()) as { authRequired: boolean }).authRequired).toBe(true);
  });
});
