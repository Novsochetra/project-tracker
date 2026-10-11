import type { CreatedInvite, Invite, ProjectSummary, SessionState } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { INVITE_TTL_MS } from '../../src/auth/invites';
import { addOwner, cookieOf, JSON_HEADERS, signIn, testClock } from '../helpers/auth';
import { addUser } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const NEWCOMER = { name: 'Sam', email: 'Sam@Example.com ', password: 'a long new password' };

describe.each(DIALECTS)('invites (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });

  const send = (method: string, path: string, cookie?: string, body?: unknown) =>
    api.app.request(path, {
      method,
      headers: { ...JSON_HEADERS, ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  async function invite(cookie: string): Promise<CreatedInvite> {
    const response = await send('POST', '/api/invites', cookie);
    expect(response.status).toBe(201);
    return (await response.json()) as CreatedInvite;
  }

  async function ownerCookie(): Promise<string> {
    await addOwner(api.db);
    return signIn(api.app);
  }

  const accept = (secret: string, person = NEWCOMER) =>
    send('POST', '/api/invites/accept', undefined, { secret, ...person });

  const errorOf = async (response: Response) =>
    ((await response.json()) as { error: { message: string } }).error.message;

  it('lets the owner invite someone, who signs up, is signed in and starts with no projects', async () => {
    const owner = await ownerCookie();
    await send('POST', '/api/projects', owner, { name: 'Mobile', key: 'MOB' });
    const { invite: made, secret } = await invite(owner);
    expect(made.expiresAt - made.createdAt).toBe(INVITE_TTL_MS);

    const check = await send('POST', '/api/invites/check', undefined, { secret });
    expect(await check.json()).toEqual({ expiresAt: made.expiresAt });
    const accepted = await accept(secret);
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toEqual<SessionState>({
      authRequired: true,
      authenticated: true,
      email: 'sam@example.com',
      name: 'Sam',
      role: 'user',
    });

    const cookie = cookieOf(accepted);
    const projects = await send('GET', '/api/projects', cookie);
    expect(await projects.json()).toEqual([]);
    const own = await send('POST', '/api/projects', cookie, { name: 'Garden' });
    expect(own.status).toBe(201);
    const ownerProjects = (await (
      await send('GET', '/api/projects', owner)
    ).json()) as ProjectSummary[];
    expect(ownerProjects.map((project) => project.name)).toEqual(['Mobile']);
    const login = { email: NEWCOMER.email, password: NEWCOMER.password };
    expect((await send('POST', '/api/session', undefined, login)).status).toBe(200);
  });

  it('works once', async () => {
    const { secret } = await invite(await ownerCookie());
    expect((await accept(secret)).status).toBe(201);
    const again = await accept(secret, { ...NEWCOMER, email: 'other@example.com' });
    expect(again.status).toBe(404);
    expect(await errorOf(again)).toBe('This invite was already used. Sign in instead.');
    const check = await send('POST', '/api/invites/check', undefined, { secret });
    expect(check.status).toBe(404);
  });

  it('expires after 7 days', async () => {
    const { secret } = await invite(await ownerCookie());
    clock.advance(INVITE_TTL_MS);
    const late = await accept(secret);
    expect(late.status).toBe(404);
    expect(await errorOf(late)).toBe('This invite has expired. Ask for a new one.');
    expect(await api.db.selectFrom('users').select('email').execute()).toHaveLength(1);
  });

  it('refuses a link that was never made, and one cut short', async () => {
    const { secret } = await invite(await ownerCookie());
    for (const wrong of ['nothing-like-it', secret.slice(0, -1)]) {
      const response = await accept(wrong);
      expect(response.status).toBe(404);
      expect(await errorOf(response)).toBe('This invite link does not work. Ask for a new one.');
    }
    expect((await send('POST', '/api/invites/check', undefined, { secret: 'x' })).status).toBe(404);
  });

  it('keeps the invite when the email already has an account or the password is short', async () => {
    const { secret } = await invite(await ownerCookie());
    const taken = await accept(secret, { ...NEWCOMER, email: 'owner@example.com' });
    expect(taken.status).toBe(409);
    const short = await accept(secret, { ...NEWCOMER, password: 'short' });
    expect(short.status).toBe(400);
    expect((await accept(secret)).status).toBe(201);
  });

  it('lets only the owner, signed in with the password, make, list and cancel invites', async () => {
    const owner = await ownerCookie();
    const user = await addUser(api.db, 'user@example.com', clock.now());
    const token = { authorization: `Bearer ${user.helper.token}` };
    expect((await send('POST', '/api/invites', user.person.cookie)).status).toBe(403);
    expect((await send('GET', '/api/invites', user.person.cookie)).status).toBe(403);
    const byToken = await api.app.request('/api/invites', { method: 'POST', headers: token });
    expect(byToken.status).toBe(403);

    const { invite: made, secret } = await invite(owner);
    const open = await send('GET', '/api/invites', owner);
    expect(((await open.json()) as Invite[]).map((row) => row.id)).toEqual([made.id]);
    expect((await send('DELETE', `/api/invites/${made.id}`, user.person.cookie)).status).toBe(403);
    expect((await send('DELETE', `/api/invites/${made.id}`, owner)).status).toBe(204);
    expect((await accept(secret)).status).toBe(404);
    expect(await (await send('GET', '/api/invites', owner)).json()).toEqual([]);
  });

  it('makes no invites on a tracker without an owner', async () => {
    expect((await send('POST', '/api/invites')).status).toBe(403);
  });
});
