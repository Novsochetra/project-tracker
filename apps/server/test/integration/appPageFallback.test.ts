import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/server';

const PAGE = '<!doctype html><title>Tracker</title>';
const SCRIPT = 'self.answer = 42;\n';
const STYLE = 'body { margin: 0; }\n';

describe('the app page for paths with no file', () => {
  const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), PAGE);
  writeFileSync(join(dist, 'sw.js'), SCRIPT);
  writeFileSync(join(dist, 'assets', 'app-1234.js'), SCRIPT);
  writeFileSync(join(dist, 'assets', 'app-1234.css'), STYLE);
  const api = useTestServer('sqlite', { webDist: dist });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  // The page as a script is a syntax error and as a stylesheet a MIME error, and a 200 tells a
  // service worker's install the file is there: a missing one must look missing.
  it('answers a missing script or stylesheet with the JSON 404, never the page', async () => {
    const paths = [
      '/workbox-abc12345.js',
      '/old.mjs',
      '/theme.css',
      '/deep/path/chunk.js',
      '/SW-OLD.JS',
      '/assets/gone-9999.js',
    ];
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const res = await api.app.request(path, { method });
        expect(res.status, `${method} ${path}`).toBe(404);
        expect(res.headers.get('content-type'), `${method} ${path}`).toContain('application/json');
        if (method === 'GET') {
          expect(await res.json(), path).toMatchObject({ error: { code: 'not_found' } });
        }
      }
    }
  });

  it('answers app routes with the page', async () => {
    for (const path of ['/', '/p/MOB', '/p/MOB/1', '/p/MOB/1/']) {
      const res = await api.app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toContain('text/html');
      expect(res.headers.get('cache-control'), path).toBe('no-cache');
      expect(await res.text(), path).toBe(PAGE);
    }
  });

  it('serves scripts and stylesheets that exist', async () => {
    const files: [string, string, string][] = [
      ['/sw.js', 'javascript', SCRIPT],
      ['/assets/app-1234.js', 'javascript', SCRIPT],
      ['/assets/app-1234.css', 'text/css', STYLE],
    ];
    for (const [path, type, text] of files) {
      const res = await api.app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toContain(type);
      expect(await res.text(), path).toBe(text);
    }
  });
});
