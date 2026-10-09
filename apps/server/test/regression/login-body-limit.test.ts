import type { ErrorBody } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { addOwner, JSON_HEADERS, signIn } from '../helpers/auth';
import { useTestServer } from '../helpers/server';

const MB = 1024 * 1024;

// A body of `total` bytes that is only made as the server reads it, so the test sees how much of
// it the server took in.
function lazyBody(total: number) {
  const chunk = new TextEncoder().encode('x'.repeat(64 * 1024));
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === 0) {
        controller.enqueue(new TextEncoder().encode('{"email":"a@b.c","password":"'));
        sent = 1;
        return;
      }
      if (sent >= total) {
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
        return;
      }
      controller.enqueue(chunk);
      sent += chunk.length;
    },
  });
  return { stream, read: () => sent };
}

const post = (path: string, body: ReadableStream<Uint8Array>, headers: Record<string, string>) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, ...headers },
    body,
    duplex: 'half',
  });

// Reviewer 100: POST /api/session, open to anyone, read and parsed a whole 150 MB body before any
// check or limit (memory went from 110 MB to 690 MB and stayed). It now refuses a body bigger
// than a sign-in needs, without reading past that.
describe('regression: sign-in reads only a small body', () => {
  const api = useTestServer('sqlite');

  it('refuses a big body by its length without reading it', async () => {
    const body = lazyBody(150 * MB);
    const res = await api.app.request(
      post('/api/session', body.stream, { 'content-length': String(150 * MB) }),
    );
    expect(res.status).toBe(413);
    expect(((await res.json()) as ErrorBody).error.code).toBe('too_large');
    expect(body.read()).toBeLessThan(MB);
  });

  it('stops reading a big body sent without a length', async () => {
    const body = lazyBody(150 * MB);
    const res = await api.app.request(post('/api/session', body.stream, {}));
    expect(res.status).toBe(413);
    expect(body.read()).toBeLessThan(MB);
  });

  it('still signs in with the longest email and password allowed', async () => {
    await addOwner(api.db);
    const res = await api.app.request('/api/session', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email: `${'e'.repeat(240)}@example.com`,
        password: '\u0001'.repeat(1024),
      }),
    });
    expect(res.status).toBe(401);
  });

  it('caps every other JSON body at 1 MB, after sign-in, and keeps the biggest real edits', async () => {
    await addOwner(api.db);
    const cookie = await signIn(api.app);
    const body = lazyBody(150 * MB);
    const res = await api.app.request(post('/api/projects', body.stream, { cookie }));
    expect(res.status).toBe(413);
    expect(body.read()).toBeLessThan(2 * MB);

    const created = await api.app.request('/api/projects', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ name: 'Mobile', key: 'MOB', description: '\u0001'.repeat(5000) }),
    });
    expect(created.status).toBe(201);
    const report = await api.app.request('/api/reports/preview', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ text: '\u0001'.repeat(100_000) }),
    });
    expect(report.status).not.toBe(413);
  });
});
