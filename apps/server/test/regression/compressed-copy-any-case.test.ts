import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/server';

const SCRIPT = `self.answer = ${JSON.stringify('forty-two '.repeat(200))};\n`;

// The 404 for a copy asked for by name matched only lower-case `.br` and `.gz`. On a disk that
// ignores letter case (macOS) `/sw.js.BR` found sw.js.br and sent raw brotli as
// application/octet-stream; elsewhere it fell through to the app shell.
describe('a compressed copy asked for by name in another letter case', () => {
  const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
  mkdirSync(join(dist, 'assets'));
  for (const path of ['index.html', 'sw.js', join('assets', 'app-1234.js')]) {
    writeFileSync(join(dist, path), SCRIPT);
    writeFileSync(join(dist, `${path}.br`), brotliCompressSync(SCRIPT));
    writeFileSync(join(dist, `${path}.gz`), gzipSync(SCRIPT));
  }
  const api = useTestServer('sqlite', { webDist: dist });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it('answers the usual JSON 404', async () => {
    for (const path of ['/sw.js.BR', '/sw.js.Br', '/index.html.GZ', '/assets/app-1234.js.gZ']) {
      const res = await api.app.request(path, { headers: { 'accept-encoding': 'gzip, br' } });
      expect(res.status, path).toBe(404);
      expect(res.headers.get('content-type'), path).toContain('application/json');
      expect(res.headers.has('content-encoding'), path).toBe(false);
      expect(await res.json(), path).toMatchObject({ error: { code: 'not_found' } });
    }
  });
});
