import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/server';

const PAGE = '<!doctype html><title>Tracker</title>';
const MANIFEST = '{"name":"Tracker"}';
const ICON = Buffer.from([0, 0, 1, 0]);

// PT-106: only a missing script or stylesheet got the JSON 404 (PT-102). A missing icon, manifest
// or source map still got the app page with a 200, so a browser or a cache took HTML for the file.
describe('a missing file of any kind outside /api', () => {
  const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
  mkdirSync(join(dist, 'icons'));
  writeFileSync(join(dist, 'index.html'), PAGE);
  writeFileSync(join(dist, 'manifest.webmanifest'), MANIFEST);
  writeFileSync(join(dist, 'favicon.ico'), ICON);
  writeFileSync(join(dist, 'icons', 'icon-192.png'), ICON);
  const api = useTestServer('sqlite', { webDist: dist });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it('answers the JSON 404, never the page', async () => {
    const paths = [
      '/icons/gone-512.png',
      '/old.webmanifest',
      '/favicon-32.ico',
      '/data.json',
      '/assets/app-1234.js.map',
      '/sw.js.map',
      '/.well-known/assetlinks.json',
      '/robots.txt',
      '/Logo.PNG',
      '/.env',
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

  it('still serves those files when they are there', async () => {
    const files: [string, string][] = [
      ['/manifest.webmanifest', 'manifest+json'],
      ['/favicon.ico', 'image/'],
      ['/icons/icon-192.png', 'image/png'],
    ];
    for (const [path, type] of files) {
      const res = await api.app.request(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toContain(type);
    }
  });

  it('still answers app routes, which have no extension, with the page', async () => {
    for (const path of ['/', '/p/MOB', '/p/MOB2/12', '/p/MOB/1/', '/.well-known/']) {
      const res = await api.app.request(path);
      expect(res.status, path).toBe(200);
      expect(await res.text(), path).toBe(PAGE);
    }
  });
});
