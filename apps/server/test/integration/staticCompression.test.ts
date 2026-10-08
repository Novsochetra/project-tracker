import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { fileUpload, imageUpload } from '../helpers/fixtures';
import { useTestServer } from '../helpers/server';

const SCRIPT = `export const answer = ${JSON.stringify('forty-two '.repeat(200))};\n`;
const PAGE = `<!doctype html><title>Tracker</title>${'<p>shell</p>'.repeat(100)}`;
const MANIFEST = JSON.stringify({ name: 'Tracker', description: 'Tickets '.repeat(40) });
const BROWSER = 'gzip, deflate, br, zstd';
const IMMUTABLE = 'public, max-age=31536000, immutable';

// The build writes a .br and a .gz copy next to each text file (apps/web/src/build/precompress.ts).
function writeWithCopies(path: string, text: string): void {
  writeFileSync(path, text);
  writeFileSync(`${path}.br`, brotliCompressSync(text));
  writeFileSync(`${path}.gz`, gzipSync(text));
}

const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
mkdirSync(join(dist, 'assets'));
writeWithCopies(join(dist, 'index.html'), PAGE);
writeWithCopies(join(dist, 'sw.js'), SCRIPT);
writeWithCopies(join(dist, 'manifest.webmanifest'), MANIFEST);
writeWithCopies(join(dist, 'assets', 'app-1234.js'), SCRIPT);
writeFileSync(join(dist, 'assets', 'plain-5678.js'), SCRIPT);
writeFileSync(join(dist, 'icon-192.png'), 'not really a png');

const bytesOf = async (res: Response) => Buffer.from(await res.arrayBuffer());

describe('web app files over the wire', () => {
  const api = useTestServer('sqlite', { webDist: dist });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  const get = (
    path: string,
    acceptEncoding?: string,
    init: RequestInit = {},
    headers: Record<string, string> = {},
  ) =>
    api.app.request(path, {
      ...init,
      headers: { ...headers, ...(acceptEncoding ? { 'accept-encoding': acceptEncoding } : {}) },
    });
  const revalidate = (path: string, acceptEncoding: string | undefined, etag: string) =>
    get(path, acceptEncoding, {}, { 'if-none-match': etag });

  it('sends brotli when the browser takes it, decoding to the file once', async () => {
    const res = await get('/assets/app-1234.js', BROWSER);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    expect(res.headers.get('content-type')).toContain('text/javascript');
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE);
    const body = await bytesOf(res);
    expect(res.headers.get('content-length')).toBe(String(body.length));
    expect(body.length).toBeLessThan(SCRIPT.length / 5);
    expect(brotliDecompressSync(body).toString()).toBe(SCRIPT);
  });

  it('sends gzip to a browser without brotli', async () => {
    const res = await get('/assets/app-1234.js', 'gzip, deflate');
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    expect(gunzipSync(await bytesOf(res)).toString()).toBe(SCRIPT);
  });

  it('sends the file as it is to a client that asks for no encoding', async () => {
    for (const acceptEncoding of [undefined, 'identity']) {
      const res = await get('/assets/app-1234.js', acceptEncoding);
      expect(res.headers.has('content-encoding'), acceptEncoding).toBe(false);
      expect(res.headers.get('vary'), acceptEncoding).toBe('Accept-Encoding');
      expect(res.headers.get('content-length'), acceptEncoding).toBe(String(SCRIPT.length));
      expect(res.headers.get('cache-control'), acceptEncoding).toBe(IMMUTABLE);
      expect(await res.text(), acceptEncoding).toBe(SCRIPT);
    }
  });

  it('compresses the app shell and the service worker and keeps them uncached', async () => {
    for (const path of ['/', '/p/MA/3', '/sw.js']) {
      const res = await get(path, BROWSER);
      expect(res.headers.get('content-encoding'), path).toBe('br');
      expect(res.headers.get('vary'), path).toBe('Accept-Encoding');
      expect(res.headers.get('cache-control'), path).toBe('no-cache');
      const text = brotliDecompressSync(await bytesOf(res)).toString();
      expect(text, path).toBe(path === '/sw.js' ? SCRIPT : PAGE);
    }
  });

  it('reads Accept-Encoding in any letter case and with weights, where q=0 refuses', async () => {
    const cases: [string, string | null][] = [
      ['br;q=1', 'br'],
      ['BR', 'br'],
      ['Gzip, Deflate', 'gzip'],
      ['gzip;q=0.5, br;q=0.8', 'br'],
      ['br;q=0, gzip', 'gzip'],
      ['br; q=0.000, gzip;Q=0', null],
      ['*', 'br'],
      ['br;q=0, *;q=0.1', 'gzip'],
      ['*;q=0', null],
    ];
    for (const [acceptEncoding, encoding] of cases) {
      const res = await get('/assets/app-1234.js', acceptEncoding);
      expect(res.headers.get('content-encoding'), acceptEncoding).toBe(encoding);
      expect(res.headers.get('vary'), acceptEncoding).toBe('Accept-Encoding');
      const body = await bytesOf(res);
      const text =
        encoding === 'br'
          ? brotliDecompressSync(body)
          : encoding === 'gzip'
            ? gunzipSync(body)
            : body;
      expect(text.toString(), acceptEncoding).toBe(SCRIPT);
    }
  });

  it('answers 404 to a direct request for a compressed copy', async () => {
    for (const path of ['/index.html.br', '/sw.js.gz', '/assets/app-1234.js.br']) {
      const res = await get(path, BROWSER);
      expect(res.status, path).toBe(404);
      expect(res.headers.has('content-encoding'), path).toBe(false);
      expect(res.headers.get('content-type'), path).not.toBe('application/octet-stream');
    }
  });

  it('gives the shell, the service worker and the manifest a weak ETag per encoding', async () => {
    for (const path of ['/', '/sw.js', '/manifest.webmanifest']) {
      const etags = new Set<string>();
      for (const acceptEncoding of [BROWSER, 'gzip', undefined]) {
        const res = await get(path, acceptEncoding);
        expect(res.status, path).toBe(200);
        const etag = res.headers.get('etag');
        expect(etag, path).toMatch(/^W\/"[^"]+"$/);
        etags.add(etag!);
        const length = String((await bytesOf(res)).length);
        expect(res.headers.get('content-length'), path).toBe(length);
        const head = await get(path, acceptEncoding, { method: 'HEAD' });
        expect(head.headers.get('etag'), path).toBe(etag);
        expect(head.headers.get('content-length'), path).toBe(length);
      }
      expect(etags.size, path).toBe(3);
    }
    const shell = (await get('/', BROWSER)).headers.get('etag');
    expect((await get('/p/MA/3', BROWSER)).headers.get('etag')).toBe(shell);
  });

  it('answers 304 with no body when the ETag still matches, on GET and HEAD', async () => {
    for (const path of ['/', '/p/MA/3', '/sw.js', '/manifest.webmanifest']) {
      for (const acceptEncoding of [BROWSER, undefined]) {
        const etag = (await get(path, acceptEncoding)).headers.get('etag')!;
        const res = await revalidate(path, acceptEncoding, etag);
        expect(res.status, path).toBe(304);
        expect(res.headers.get('etag'), path).toBe(etag);
        expect(res.headers.get('cache-control'), path).toBe('no-cache');
        expect(res.headers.get('vary'), path).toBe('Accept-Encoding');
        expect(await res.text(), path).toBe('');
        const head = await get(path, acceptEncoding, { method: 'HEAD' }, { 'if-none-match': etag });
        expect(head.status, path).toBe(304);
      }
    }
  });

  it('matches If-None-Match lists, strong or weak, and only for the same encoding', async () => {
    const etag = (await get('/sw.js', BROWSER)).headers.get('etag')!;
    const strong = etag.replace(/^W\//, '');
    expect((await revalidate('/sw.js', BROWSER, `"other", ${strong}`)).status).toBe(304);
    expect((await revalidate('/sw.js', BROWSER, '*')).status).toBe(304);
    expect((await revalidate('/sw.js', BROWSER, 'W/"other"')).status).toBe(200);
    const plain = await revalidate('/sw.js', 'gzip', etag);
    expect(plain.status).toBe(200);
    expect(gunzipSync(await bytesOf(plain)).toString()).toBe(SCRIPT);
  });

  it('sends a new service worker of the same size in full, so an update check sees it', async () => {
    const before = (await get('/sw.js', BROWSER)).headers.get('etag')!;
    const next = SCRIPT.replace('forty-two', 'forty-six');
    expect(next.length).toBe(SCRIPT.length);
    writeWithCopies(join(dist, 'sw.js'), next);
    try {
      const res = await revalidate('/sw.js', BROWSER, before);
      expect(res.status).toBe(200);
      expect(res.headers.get('etag')).not.toBe(before);
      expect(brotliDecompressSync(await bytesOf(res)).toString()).toBe(next);
    } finally {
      writeWithCopies(join(dist, 'sw.js'), SCRIPT);
    }
  });

  it('keeps the long cache on hashed assets', async () => {
    const res = await get('/assets/app-1234.js', BROWSER);
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE);
    expect((await get('/assets/app-1234.js', BROWSER, {}, { 'if-none-match': '*' })).status).toBe(
      200,
    );
  });

  it('answers HEAD with the headers of the encoded file and no body', async () => {
    const res = await get('/assets/app-1234.js', BROWSER, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    expect(res.headers.get('content-length')).toBe(String(brotliCompressSync(SCRIPT).length));
    expect(await res.text()).toBe('');
  });

  it('sends the plain file when the build left no compressed copy', async () => {
    const res = await get('/assets/plain-5678.js', BROWSER);
    expect(res.status).toBe(200);
    expect(res.headers.has('content-encoding')).toBe(false);
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE);
    expect(await res.text()).toBe(SCRIPT);
  });

  it('leaves images alone', async () => {
    const res = await get('/icon-192.png', BROWSER);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.has('content-encoding')).toBe(false);
    expect(res.headers.has('vary')).toBe(false);
  });

  it('keeps attachment files and their ranges unencoded', async () => {
    const text = (await api.upload(fileUpload({ bytes: Buffer.from(SCRIPT) }))).body;
    const image = (await api.upload(imageUpload())).body;
    for (const url of [text.url, image.url]) {
      const whole = await get(url, BROWSER);
      expect(whole.status, url).toBe(200);
      expect(whole.headers.has('content-encoding'), url).toBe(false);
      const part = await api.app.request(url, {
        headers: { 'accept-encoding': BROWSER, range: 'bytes=0-3' },
      });
      expect(part.status, url).toBe(206);
      expect(part.headers.has('content-encoding'), url).toBe(false);
      expect(part.headers.get('content-length'), url).toBe('4');
      expect((await bytesOf(part)).length, url).toBe(4);
    }
    expect(Buffer.from(await (await get(text.url, BROWSER)).arrayBuffer()).toString()).toBe(SCRIPT);
  });

  it('sends API answers and live events unencoded, and events without buffering', async () => {
    const projects = await get('/api/projects', BROWSER);
    expect(projects.headers.has('content-encoding')).toBe(false);
    const events = await get('/api/events', BROWSER);
    expect(events.headers.get('content-type')).toBe('text/event-stream');
    expect(events.headers.has('content-encoding')).toBe(false);
    const reader: ReadableStreamDefaultReader<Uint8Array> = events.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain(': connected');
    await reader.cancel();
  });
});
