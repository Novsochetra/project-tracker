import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/server';

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=15552000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

const headersOf = (response: Response | { headers: Headers }) =>
  Object.fromEntries(response.headers.entries());

describe('response headers', () => {
  const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Tracker</title>');
  const api = useTestServer('sqlite', { webDist: dist });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it('secures API answers, errors and the app page', async () => {
    for (const path of ['/api/health', '/api/projects', '/api/nothing-here', '/', '/projects/PT']) {
      const response = await api.app.request(path);
      expect(headersOf(response), path).toMatchObject(SECURITY_HEADERS);
      expect(response.headers.get('x-accel-buffering'), path).toBeNull();
    }
  });

  it('asks proxies not to buffer or compress the live-update stream', async () => {
    const response = await api.app.request('/api/events');
    expect(headersOf(response)).toMatchObject({
      ...SECURITY_HEADERS,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    });
    await response.body?.cancel();
  });
});
