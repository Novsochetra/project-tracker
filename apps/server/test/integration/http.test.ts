import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ErrorBody } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp, type AppDeps } from '../../src/app';
import { REPO_ROOT } from '../../src/config';
import { imageForm } from '../helpers/fixtures';
import { DIALECTS, clientFor, useTestServer, type TestDeps } from '../helpers/server';

const TOKEN = 'correct horse battery staple';

describe.each(DIALECTS)('http surface (%s)', (dialect) => {
  const api = useTestServer(dialect, { repoRoot: '/repo', version: '1.2.3' });

  const appWith = (deps: TestDeps) =>
    createApp({
      db: api.db,
      storage: api.storage,
      events: api.broadcaster,
      ...deps,
    } satisfies AppDeps);

  it('reports health', async () => {
    const res = await api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('answers unknown API routes with a JSON 404', async () => {
    const res = await api.get<ErrorBody>('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect((await api.get('/index.html')).status).toBe(404);
  });

  it('lists distinct, sorted assignees', async () => {
    const client = api.client();
    await client.createProject({ name: 'Mobile app' });
    for (const assignee of ['Sophea', '', 'Dara', 'Sophea', ' Bo ']) {
      await client.createTicket('MA', { title: 'x', assignee });
    }
    const res = await api.get<string[]>('/api/people');
    expect(res.body).toEqual(['Bo', 'Dara', 'Sophea']);
    expect(await client.listPeople()).toEqual(['Bo', 'Dara', 'Sophea']);
  });

  it('describes the server for the Connect Claude Code sheet', async () => {
    const res = await api.get('/api/meta');
    expect(res.body).toEqual({
      version: '1.2.3',
      repoRoot: '/repo',
      mcpEntry: '/repo/apps/agent/dist/mcp.js',
      cliEntry: '/repo/apps/agent/dist/cli.js',
      authRequired: false,
    });
    expect(await api.client().getMeta()).toEqual(res.body);
    const defaults = await appWith({ token: TOKEN, repoRoot: REPO_ROOT }).request('/api/meta', {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(await defaults.json()).toMatchObject({
      repoRoot: REPO_ROOT,
      mcpEntry: join(REPO_ROOT, 'apps/agent/dist/mcp.js'),
      authRequired: true,
    });
    expect(REPO_ROOT).toBe(join(import.meta.dirname, '../../../..'));
  });

  describe('test reset', () => {
    it('does not exist unless enabled', async () => {
      expect((await api.post('/api/test/reset')).status).toBe(404);
    });

    it('deletes every row and image file when enabled', async () => {
      const client = api.client();
      await client.createProject({ name: 'Mobile app' });
      const ticket = await client.createTicket('MA', { title: 'x' });
      await client.addComment(ticket.key, { text: 'note' });
      await api.post('/api/attachments', imageForm({ ticketKey: ticket.key }));
      await api.post('/api/attachments', imageForm());
      api.events.length = 0;

      const res = await appWith({ testReset: true }).request('/api/test/reset', { method: 'POST' });
      expect(res.status).toBe(204);
      for (const table of [
        'projects',
        'statuses',
        'tickets',
        'activities',
        'attachments',
      ] as const) {
        expect(await api.db.selectFrom(table).select('id').execute(), table).toEqual([]);
      }
      expect(api.storage.files.size).toBe(0);
      expect(api.events).toEqual([{ type: 'changed', projectId: null, ticketId: null }]);
    });
  });

  describe('access token', () => {
    const secured = () => appWith({ token: TOKEN });

    it('leaves the API open without a token', async () => {
      expect((await api.get('/api/projects')).status).toBe(200);
      expect((await api.get('/api/session')).body).toEqual({
        authRequired: false,
        authenticated: true,
      });
      expect((await api.post('/api/session', { token: 'anything' })).body).toEqual({
        authRequired: false,
        authenticated: true,
      });
    });

    it('requires the token on every API route except session and health', async () => {
      const app = secured();
      for (const [method, path] of [
        ['GET', '/api/projects'],
        ['POST', '/api/projects'],
        ['GET', '/api/events'],
        ['GET', '/api/meta'],
        ['GET', '/api/people'],
        ['GET', '/api/attachments/x/file'],
        ['GET', '/api/nope'],
      ] as const) {
        const res = await app.request(path, { method });
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(((await res.json()) as ErrorBody).error.code).toBe('unauthorized');
      }
      expect((await app.request('/api/health')).status).toBe(200);
      expect(await (await app.request('/api/session')).json()).toEqual({
        authRequired: true,
        authenticated: false,
      });
    });

    it('accepts a bearer token', async () => {
      const app = secured();
      const ok = await app.request('/api/projects', {
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(ok.status).toBe(200);
      const wrong = await app.request('/api/projects', {
        headers: { authorization: 'Bearer nope' },
      });
      expect(wrong.status).toBe(401);
      expect(
        (await app.request('/api/session', { headers: { authorization: `Bearer ${TOKEN}` } }))
          .status,
      ).toBe(200);
    });

    it('exchanges the token for an HttpOnly session cookie', async () => {
      const app = secured();
      const json = { 'content-type': 'application/json' };
      const wrong = await app.request('/api/session', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ token: 'nope' }),
      });
      expect(wrong.status).toBe(401);
      expect(wrong.headers.get('set-cookie')).toBeNull();

      const res = await app.request('/api/session', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ token: TOKEN }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ authRequired: true, authenticated: true });
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toMatch(/^tracker_session=[^;]+;/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain(TOKEN);
      expect(cookie).not.toContain('Secure');

      const session = cookie.split(';')[0]!;
      expect((await app.request('/api/projects', { headers: { cookie: session } })).status).toBe(
        200,
      );
      expect(
        await (await app.request('/api/session', { headers: { cookie: session } })).json(),
      ).toEqual({
        authRequired: true,
        authenticated: true,
      });
      const forged = await app.request('/api/projects', {
        headers: { cookie: 'tracker_session=forged' },
      });
      expect(forged.status).toBe(401);
      const otherServer = appWith({ token: 'another token' });
      expect(
        (await otherServer.request('/api/projects', { headers: { cookie: session } })).status,
      ).toBe(401);
    });

    it('marks the cookie Secure behind https', async () => {
      const res = await secured().request('https://tracker.example/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: TOKEN }),
      });
      expect(res.headers.get('set-cookie')).toContain('Secure');
    });

    it('works with the typed client', async () => {
      const app = secured();
      expect(await clientFor(app, { token: TOKEN }).listProjects()).toEqual([]);
      expect(await clientFor(app, { token: TOKEN }).getSession()).toEqual({
        authRequired: true,
        authenticated: true,
      });
      expect(await clientFor(app).getSession()).toEqual({
        authRequired: true,
        authenticated: false,
      });
      expect(await clientFor(app).login(TOKEN)).toEqual({
        authRequired: true,
        authenticated: true,
      });
      await expect(clientFor(app).login('nope')).rejects.toMatchObject({ status: 401 });
      await expect(clientFor(app).listProjects()).rejects.toMatchObject({
        status: 401,
        code: 'unauthorized',
      });
    });
  });

  describe('web app', () => {
    const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Tracker</title>');
    writeFileSync(join(dist, 'assets', 'app-1234.js'), 'console.log(1)');
    writeFileSync(join(dist, 'manifest.webmanifest'), '{}');
    afterAll(() => rmSync(dist, { recursive: true, force: true }));

    const web = () => appWith({ webDist: dist });

    it('serves index.html at the root and for client routes, without caching', async () => {
      for (const path of ['/', '/p/MA', '/p/MA/3']) {
        const res = await web().request(path);
        expect(res.status, path).toBe(200);
        expect(await res.text()).toContain('<title>Tracker</title>');
        expect(res.headers.get('content-type')).toContain('text/html');
        expect(res.headers.get('cache-control')).toBe('no-cache');
      }
    });

    it('serves hashed assets with an immutable cache and other files without one', async () => {
      const asset = await web().request('/assets/app-1234.js');
      expect(asset.status).toBe(200);
      expect(await asset.text()).toBe('console.log(1)');
      expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      const manifest = await web().request('/manifest.webmanifest');
      expect(manifest.headers.get('cache-control')).toBe('no-cache');
      expect((await web().request('/assets/missing.js')).status).toBe(404);
    });

    it('keeps API routes and errors as JSON', async () => {
      const app = web();
      expect(await (await app.request('/api/health')).json()).toEqual({ ok: true });
      const missing = await app.request('/api/nope');
      expect(missing.status).toBe(404);
      expect(missing.headers.get('content-type')).toContain('application/json');
      expect((await app.request('/', { method: 'POST' })).status).toBe(404);
    });

    it('is skipped when the folder does not exist', async () => {
      const app = appWith({ webDist: join(dist, 'missing') });
      expect((await app.request('/')).status).toBe(404);
    });
  });
});
