import type { SessionState } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { authNotice } from '../../src/auth/startupNotice';
import { loadAuthConfig } from '../../src/authConfig';
import { useTestServer } from '../helpers/server';

// Reviewer 100: a server on 127.0.0.1 without an owner said "open to this machine only", but
// `npm run dev` runs Vite on every interface and Vite passes /api on to it, so every device on the
// LAN or tailnet could use it, and it took any Host, so a page could reach it by DNS rebinding.
// A server that had relied on TRACKER_TOKEN lost that protection without a word.
describe('regression: a tracker without an owner is open only to this machine', () => {
  const api = useTestServer('sqlite');
  const local = () =>
    createApp({
      db: api.db,
      storage: api.storage,
      events: api.broadcaster,
      auth: loadAuthConfig({}, '127.0.0.1'),
    });
  const status = async (url: string, headers: Record<string, string> = {}) =>
    (await local().request(url, { headers })).status;

  it('answers requests made on this machine', async () => {
    for (const origin of ['http://localhost:4100', 'http://127.0.0.1:4100', 'http://[::1]:4100']) {
      expect(await status(`${origin}/api/projects`), origin).toBe(200);
    }
    for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      const forwarded = { 'x-forwarded-for': address, 'x-forwarded-host': 'localhost:5173' };
      expect(await status('http://localhost:4100/api/projects', forwarded), address).toBe(200);
    }
  });

  it('asks everyone else to sign in: other hosts, and the LAN through the dev server', async () => {
    expect(await status('http://192.168.1.7:4100/api/projects')).toBe(401);
    expect(await status('http://rebound.example:4100/api/projects')).toBe(401);
    const lan = { 'x-forwarded-for': '192.168.1.20', 'x-forwarded-host': '192.168.1.7:5173' };
    expect(await status('http://localhost:4100/api/projects', lan)).toBe(401);
    const rebound = { 'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': 'rebound.example:5173' };
    expect(await status('http://localhost:4100/api/projects', rebound)).toBe(401);
    const mixed = { 'x-forwarded-for': '192.168.1.20, 127.0.0.1' };
    expect(await status('http://localhost:4100/api/projects', mixed)).toBe(401);

    const session = await local().request('http://localhost:4100/api/session', { headers: lan });
    expect((await session.json()) as SessionState).toEqual({
      authRequired: true,
      authenticated: false,
      setupRequired: true,
    });
  });

  it('stays closed when TRACKER_TOKEN is set, and says so', async () => {
    const config = loadAuthConfig({ TRACKER_TOKEN: 'a-long-secret' }, '127.0.0.1');
    expect(config.openWithoutOwner).toBe(false);
    const app = createApp({
      db: api.db,
      storage: api.storage,
      events: api.broadcaster,
      auth: config,
    });
    expect((await app.request('http://localhost:4100/api/projects')).status).toBe(401);
    expect((await authNotice(api.db, config)).join('\n')).toMatch(
      /TRACKER_TOKEN is set.*every request is refused/s,
    );
  });

  it('says who it is open to at start', async () => {
    const notice = (await authNotice(api.db, loadAuthConfig({}, '127.0.0.1'))).join('\n');
    expect(notice).toContain('open to requests from this machine only');
    expect(notice).not.toContain('open to this machine only');
  });
});
