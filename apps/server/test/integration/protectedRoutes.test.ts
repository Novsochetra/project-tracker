import type { CreatedApiToken, ErrorBody, SessionState } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { deleteAllRows } from '../../src/repositories/reset';
import { addOwner, JSON_HEADERS, signIn } from '../helpers/auth';
import { DIALECTS, useTestServer } from '../helpers/server';

// Every route the API has, by group. Each must refuse a request that has no session or token.
const PROTECTED: readonly (readonly [string, string])[] = [
  ['GET', '/api/projects'],
  ['POST', '/api/projects'],
  ['GET', '/api/projects/MOB'],
  ['PATCH', '/api/projects/MOB'],
  ['DELETE', '/api/projects/MOB'],
  ['GET', '/api/projects/MOB/board'],
  ['GET', '/api/projects/MOB/prompt'],
  ['POST', '/api/projects/MOB/statuses'],
  ['PUT', '/api/projects/MOB/statuses/order'],
  ['PATCH', '/api/statuses/s1'],
  ['DELETE', '/api/statuses/s1'],
  ['GET', '/api/tickets'],
  ['GET', '/api/projects/MOB/tickets'],
  ['POST', '/api/projects/MOB/tickets'],
  ['GET', '/api/tickets/MOB-1'],
  ['PATCH', '/api/tickets/MOB-1'],
  ['DELETE', '/api/tickets/MOB-1'],
  ['POST', '/api/tickets/MOB-1/move'],
  ['GET', '/api/tickets/MOB-1/prompt'],
  ['POST', '/api/tickets/MOB-1/sent'],
  ['POST', '/api/tickets/MOB-1/comments'],
  ['PATCH', '/api/activity/a1'],
  ['DELETE', '/api/activity/a1'],
  ['POST', '/api/attachments'],
  ['GET', '/api/attachments/f1/file'],
  ['HEAD', '/api/attachments/f1/file'],
  ['DELETE', '/api/attachments/f1'],
  ['POST', '/api/reports/preview'],
  ['POST', '/api/reports/apply'],
  ['POST', '/api/projects/MOB/claim'],
  ['POST', '/api/tickets/MOB-1/claim'],
  ['POST', '/api/tickets/MOB-1/submit'],
  ['POST', '/api/tickets/MOB-1/review'],
  ['GET', '/api/run-activity'],
  ['GET', '/api/people'],
  ['GET', '/api/meta'],
  ['GET', '/api/events'],
  ['GET', '/api/tokens'],
  ['POST', '/api/tokens'],
  ['DELETE', '/api/tokens/t1'],
  ['DELETE', '/api/sessions'],
  ['POST', '/api/password'],
  ['GET', '/api/users'],
  ['POST', '/api/users/u1/reset-link'],
  ['DELETE', '/api/users/u1/reset-link'],
  ['POST', '/api/runs/r1/steps'],
  ['GET', '/api/runs/r1/steps'],
  ['POST', '/api/runs/r1/changes'],
  ['GET', '/api/tickets/MOB-1/changes'],
  ['PUT', '/api/tickets/MOB-1/changes/viewed'],
  ['POST', '/api/tickets/MOB-1/changes/verdict'],
  ['POST', '/api/runs/r1/requests'],
  ['GET', '/api/runs/r1/requests'],
  ['POST', '/api/requests/q1/answer'],
  ['GET', '/api/requests/q1/wait'],
  ['POST', '/api/requests/q1/cancel'],
  ['POST', '/api/tickets/MOB-1/questions'],
  ['GET', '/api/tickets/MOB-1/questions'],
  ['GET', '/api/questions/q1/wait'],
  ['POST', '/api/questions/q1/answer'],
  ['POST', '/api/questions/q1/cancel'],
  ['GET', '/api/push/key'],
  ['PUT', '/api/push/subscription'],
  ['DELETE', '/api/push/subscription'],
  ['POST', '/api/test/reset'],
  ['GET', '/api/nope'],
];

const init = (method: string, headers: Record<string, string> = {}): RequestInit => ({
  method,
  headers: { ...JSON_HEADERS, ...headers },
  ...(method === 'GET' || method === 'HEAD' ? {} : { body: '{}' }),
});

describe.each(DIALECTS)('protected routes (%s)', (dialect) => {
  const api = useTestServer(dialect, { testReset: true });

  beforeEach(async () => {
    await addOwner(api.db);
  });

  it('refuse requests without a session or token, with a JSON 401', async () => {
    for (const [method, path] of PROTECTED) {
      const res = await api.app.request(path, init(method));
      expect(res.status, `${method} ${path}`).toBe(401);
      if (method === 'HEAD') continue;
      expect(((await res.json()) as ErrorBody).error, `${method} ${path}`).toEqual({
        code: 'unauthorized',
        message: 'Sign in to use this tracker.',
      });
    }
  });

  it('refuse a forged cookie or an unknown token', async () => {
    const forged: Record<string, string>[] = [
      { cookie: 'tracker_session=forged' },
      { authorization: 'Bearer trk_forged' },
      { authorization: 'Basic b3duZXI6cGFzcw==' },
    ];
    for (const headers of forged) {
      for (const [method, path] of PROTECTED) {
        const res = await api.app.request(path, init(method, headers));
        expect(res.status, `${method} ${path} ${JSON.stringify(headers)}`).toBe(401);
      }
    }
  });

  it('let a signed-in owner through to every route', async () => {
    const cookie = await signIn(api.app);
    for (const [method, path] of PROTECTED) {
      if (path === '/api/events' || path === '/api/sessions' || path === '/api/test/reset')
        continue;
      const res = await api.app.request(path, init(method, { cookie }));
      expect(res.status, `${method} ${path}`).not.toBe(401);
    }
  });

  it('let an API token through to every route but token and session management', async () => {
    const cookie = await signIn(api.app);
    const created = await api.app.request('/api/tokens', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ name: 'Claude laptop' }),
    });
    const { secret } = (await created.json()) as CreatedApiToken;
    const bearer = { authorization: `Bearer ${secret}` };
    for (const [method, path] of PROTECTED) {
      if (path === '/api/events' || path === '/api/test/reset') continue;
      const res = await api.app.request(path, init(method, bearer));
      const managing = path.startsWith('/api/tokens') || path === '/api/sessions';
      if (managing) expect(res.status, `${method} ${path}`).toBe(403);
      else expect(res.status, `${method} ${path}`).not.toBe(401);
    }
  });

  it('keep health and the sign-in routes public', async () => {
    expect((await api.app.request('/api/health')).status).toBe(200);
    expect((await api.app.request('/api/health', { method: 'HEAD' })).status).toBe(200);
    const session = await api.app.request('/api/session');
    expect(session.status).toBe(200);
    expect((await session.json()) as SessionState).toEqual({
      authRequired: true,
      authenticated: false,
    });
    const signOut = await api.app.request('/api/session', { method: 'DELETE' });
    expect(signOut.status).toBe(200);
  });

  it('stream live updates only to a signed-in owner', async () => {
    expect((await api.app.request('/api/events')).status).toBe(401);
    const cookie = await signIn(api.app);
    const controller = new AbortController();
    const res = await api.app.request('/api/events', {
      headers: { cookie },
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    controller.abort();
    await res.body?.cancel();
  });

  it('serve attachment files only to a signed-in owner or a token', async () => {
    const cookie = await signIn(api.app);
    const headers = { cookie };
    await api.app.request('/api/projects', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...headers },
      body: JSON.stringify({ name: 'Mobile app', key: 'MOB' }),
    });
    const upload = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'text/plain', 'x-file-name': 'notes.txt' },
      body: 'secret notes',
    });
    expect(upload.status).toBe(201);
    const { id } = (await upload.json()) as { id: string };
    const path = `/api/attachments/${id}/file`;
    expect((await api.app.request(path)).status).toBe(401);
    const file = await api.app.request(path, { headers });
    expect(file.status).toBe(200);
    expect(await file.text()).toBe('secret notes');
  });

  it('stay open while there is no owner on a tracker only this machine reaches', async () => {
    await deleteAllRows(api.db);
    expect((await api.get('/api/projects')).status).toBe(200);
    expect((await api.get('/api/session')).body).toEqual({
      authRequired: false,
      authenticated: true,
    });
    const meta = await api.get<{ authRequired: boolean }>('/api/meta');
    expect(meta.body.authRequired).toBe(false);
  });

  it('refuse everything without an owner on a public server, and say setup is needed', async () => {
    await deleteAllRows(api.db);
    const app = createApp({
      db: api.db,
      storage: api.storage,
      events: api.broadcaster,
      auth: { openWithoutOwner: false },
    });
    for (const [method, path] of PROTECTED) {
      expect((await app.request(path, init(method))).status, `${method} ${path}`).toBe(401);
    }
    expect(await (await app.request('/api/session')).json()).toEqual({
      authRequired: true,
      authenticated: false,
      setupRequired: true,
    });
  });
});
