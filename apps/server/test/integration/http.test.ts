import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ErrorBody, ServerMeta } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp, type AppDeps } from '../../src/app';
import { REPO_ROOT } from '../../src/config';
import { imageUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer, type TestDeps } from '../helpers/server';

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
    const res = await api.get<ServerMeta>('/api/meta');
    expect(res.body).toEqual({
      version: '1.2.3',
      serverUrl: 'http://localhost',
      repoRoot: '/repo',
      mcpEntry: '/repo/apps/agent/dist/mcp.js',
      cliEntry: '/repo/apps/agent/dist/cli.js',
      authRequired: false,
    });
    expect(await api.client().getMeta()).toEqual({ ...res.body, serverUrl: 'http://tracker.test' });
    const defaults = await appWith({ repoRoot: REPO_ROOT }).request('/api/meta');
    expect(await defaults.json()).toMatchObject({
      repoRoot: REPO_ROOT,
      mcpEntry: join(REPO_ROOT, 'apps/agent/dist/mcp.js'),
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
      await api.upload(imageUpload({ ticketKey: ticket.key }));
      await api.upload(imageUpload());
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
