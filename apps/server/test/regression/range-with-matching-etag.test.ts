import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestServer } from '../helpers/server';

const SCRIPT = `self.answer = ${JSON.stringify('forty-two '.repeat(200))};\n`;
const BROWSER = 'gzip, deflate, br, zstd';

// serveStatic answered Range itself, before the ETag check, so a ranged request whose
// If-None-Match matched got 206. RFC 9110 (14.2) evaluates Range only when the answer without it
// would be 200, so a matching If-None-Match must win with 304.
describe('a ranged request for a file with an ETag', () => {
  const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
  mkdirSync(join(dist, 'assets'));
  for (const path of ['index.html', 'sw.js', join('assets', 'app-1234.js')]) {
    writeFileSync(join(dist, path), SCRIPT);
    writeFileSync(join(dist, `${path}.br`), brotliCompressSync(SCRIPT));
  }
  const api = useTestServer('sqlite', { webDist: dist });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  const get = (path: string, headers: Record<string, string> = {}) =>
    api.app.request(path, { headers: { 'accept-encoding': BROWSER, ...headers } });

  it('gets 304 when If-None-Match matches', async () => {
    for (const path of ['/sw.js', '/', '/p/MA/3']) {
      const etag = (await get(path)).headers.get('etag')!;
      for (const range of ['bytes=0-3', 'bytes=999999-']) {
        const res = await get(path, { range, 'if-none-match': etag });
        expect(res.status, `${path} ${range}`).toBe(304);
        expect(res.headers.get('etag'), path).toBe(etag);
        expect(res.headers.has('content-range'), path).toBe(false);
        expect(await res.text(), path).toBe('');
      }
    }
  });

  it('gets the whole file with its tag otherwise, as these small files ignore Range', async () => {
    const etag = (await get('/sw.js')).headers.get('etag')!;
    for (const ifNoneMatch of [undefined, '"x"']) {
      const res = await get('/sw.js', {
        range: 'bytes=0-3',
        ...(ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {}),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('etag')).toBe(etag);
      expect(res.headers.has('content-range')).toBe(false);
      expect(brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString()).toBe(SCRIPT);
    }
  });

  it('leaves Range to hashed assets, which have no tag', async () => {
    const res = await get('/assets/app-1234.js', { range: 'bytes=0-3' });
    expect(res.status).toBe(206);
    expect(res.headers.has('etag')).toBe(false);
    expect((await res.arrayBuffer()).byteLength).toBe(4);
  });
});
