import type { ApiToken, CreatedApiToken, ErrorBody } from '@tracker/shared';
import { TrackerClient } from '@tracker/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashSecret } from '../../src/auth/secrets';
import { addOwner, JSON_HEADERS, signIn, testClock } from '../helpers/auth';
import { BASE_URL, clientFor, DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('API tokens (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  let cookie = '';

  const asOwner = (method: string, path: string, body?: unknown) =>
    api.app.request(path, {
      method,
      headers: { ...JSON_HEADERS, cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const create = async (name: string) => {
    const res = await asOwner('POST', '/api/tokens', { name });
    expect(res.status).toBe(201);
    return (await res.json()) as CreatedApiToken;
  };

  const list = async () => (await (await asOwner('GET', '/api/tokens')).json()) as ApiToken[];

  const withToken = (secret: string, path = '/api/projects') =>
    api.app.request(path, { headers: { authorization: `Bearer ${secret}` } });

  beforeEach(async () => {
    clock.set(1_000_000);
    await addOwner(api.db);
    cookie = await signIn(api.app);
  });

  it('creates a named token and shows its secret once', async () => {
    const created = await create('  Claude laptop ');
    expect(created.secret).toMatch(/^trk_[\w-]{43}$/);
    expect(created.token).toEqual({
      id: expect.any(String),
      name: 'Claude laptop',
      hint: created.secret.slice(0, 8),
      createdAt: 1_000_000,
      lastUsedAt: null,
    });
    const listed = await list();
    expect(listed).toEqual([created.token]);
    expect(JSON.stringify(listed)).not.toContain(created.secret);
  });

  it('keeps only a hash of the token', async () => {
    const { secret } = await create('Claude laptop');
    const rows = await api.db.selectFrom('apiTokens').selectAll().execute();
    expect(rows.map((row) => row.tokenHash)).toEqual([hashSecret(secret)]);
    expect(JSON.stringify(rows)).not.toContain(secret);
  });

  it('lets an agent in with the token as a Bearer, and notes when it was last used', async () => {
    const { secret, token } = await create('Claude laptop');
    clock.advance(5_000);
    expect((await withToken(secret)).status).toBe(200);
    expect((await list())[0]!.lastUsedAt).toBe(1_005_000);

    clock.advance(30_000);
    await withToken(secret);
    expect((await list())[0]!.lastUsedAt).toBe(1_005_000);
    clock.advance(30_000);
    await withToken(secret);
    expect((await list())[0]!.lastUsedAt).toBe(1_065_000);

    const client = clientFor(api.app, { token: secret });
    expect(await client.listProjects()).toEqual([]);
    expect(await client.getSession()).toEqual({ authRequired: true, authenticated: true });
    expect(token.lastUsedAt).toBeNull();
  });

  it('lists tokens oldest first', async () => {
    const first = await create('Claude laptop');
    clock.advance(1);
    const second = await create('CI runner');
    expect((await list()).map((token) => token.name)).toEqual(['Claude laptop', 'CI runner']);
    expect(first.secret).not.toBe(second.secret);
  });

  it('revokes a token, which then stops working at once', async () => {
    const kept = await create('Claude laptop');
    const revoked = await create('Old laptop');
    const res = await asOwner('DELETE', `/api/tokens/${revoked.token.id}`);
    expect(res.status).toBe(204);
    expect((await withToken(revoked.secret)).status).toBe(401);
    expect((await withToken(kept.secret)).status).toBe(200);
    expect((await list()).map((token) => token.id)).toEqual([kept.token.id]);

    const again = await asOwner('DELETE', `/api/tokens/${revoked.token.id}`);
    expect(again.status).toBe(404);
    expect(((await again.json()) as ErrorBody).error.message).toBe(
      'That token was already revoked.',
    );
  });

  it('needs a name of at most 60 characters', async () => {
    for (const name of ['', '   ', 'x'.repeat(61)]) {
      const res = await asOwner('POST', '/api/tokens', { name });
      expect(res.status, JSON.stringify(name)).toBe(400);
    }
    expect(await list()).toEqual([]);
  });

  it('lets only the signed-in owner manage tokens', async () => {
    const { secret, token } = await create('Claude laptop');
    for (const [method, path] of [
      ['GET', '/api/tokens'],
      ['POST', '/api/tokens'],
      ['DELETE', `/api/tokens/${token.id}`],
      ['DELETE', '/api/sessions'],
    ] as const) {
      const res = await api.app.request(path, {
        method,
        headers: { ...JSON_HEADERS, authorization: `Bearer ${secret}` },
        ...(method === 'POST' ? { body: JSON.stringify({ name: 'More' }) } : {}),
      });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect(await list()).toHaveLength(1);
  });

  it('asks for an owner before tokens can exist on a tracker without one', async () => {
    await api.db.deleteFrom('users').execute();
    const res = await api.app.request('/api/tokens');
    expect(res.status).toBe(403);
    expect(((await res.json()) as ErrorBody).error.message).toContain('npm run owner:set');
  });

  it('works through the typed client', async () => {
    const owner = new TrackerClient({
      baseUrl: BASE_URL,
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('cookie', cookie);
        const url = input instanceof Request ? input.url : String(input);
        return Promise.resolve(api.app.request(url, { ...init, headers }));
      },
    });
    const created = await owner.createApiToken({ name: 'Claude laptop' });
    expect(await owner.listApiTokens()).toEqual([created.token]);
    const agent = clientFor(api.app, { token: created.secret });
    expect(await agent.listProjects()).toEqual([]);
    await expect(agent.listApiTokens()).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    await expect(clientFor(api.app).listApiTokens()).rejects.toMatchObject({ status: 401 });
    await owner.revokeApiToken(created.token.id);
    await expect(agent.listProjects()).rejects.toMatchObject({ status: 401 });
    expect(await owner.logout()).toEqual({ authRequired: true, authenticated: false });
    await expect(owner.listApiTokens()).rejects.toMatchObject({ status: 401 });
  });
});
